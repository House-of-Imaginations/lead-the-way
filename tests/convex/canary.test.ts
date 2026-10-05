import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { castOf } from "../../convex/lib/demo/cast";
import { call, callsFor, publicFunctions } from "./sweep";
import { calderLane, seat } from "./workspace/helpers";

/**
 * THE PRIVACY CANARY (spec 5.1). Dan's private rows hold a value nothing else
 * in the demo holds. No public query may hand it to a manager (the owner,
 * with every permission, or a custom role holding only `team:insights`), or
 * to a teammate (Mei, who sees the show and tell board).
 */

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const SENTINEL = 4242;
const TITLE = "CANARY-DAN-PRIVATE";
const DAN_SLUG = "dan-okafor-ai-fundamentals";

/** The sentinel as a number of its own, or the title: never digits inside an id or a timestamp. */
const leaks = (text: string) =>
  /(?<![\d.])4242(?!\d)/.test(text) || text.includes(TITLE);

test("the canary's detector finds the sentinel and nothing else", () => {
  expect(leaks(JSON.stringify({ percent: SENTINEL }))).toBe(true);
  expect(leaks(JSON.stringify({ mean: 4242.5 }))).toBe(true);
  expect(leaks(JSON.stringify({ title: TITLE }))).toBe(true);
  expect(
    leaks(JSON.stringify({ at: 1789424242000, id: "14242people", x: 0.4242 })),
  ).toBe(false);
});

/**
 * Dan's private states. One project per person per sprint, so each is its
 * own run: a draft with his before check-in skipped, and saved projects he
 * never presented with an answered check-in. The skip's timestamp is the
 * sentinel, so this proves only that `skippedAt` is never exposed; that a skip
 * is never counted as a response is Task 3's "a skipped check-in is not a
 * response". Two half-way states `isPresented` must still refuse (Ruling 4):
 * `sharing: "team"` without `presentedAt`, and `presentedAt` with
 * `sharing: "private"`. Renamed, so the script neither presents nor links it.
 */
const CASES = [
  {
    name: "a draft and a skipped check-in",
    project: { status: "draft", sharing: "private", presentedAt: undefined },
    skipped: true,
  },
  {
    name: "a saved project he hasn't presented",
    project: { status: "saved", sharing: "team", presentedAt: undefined },
    skipped: false,
  },
  {
    name: "a saved private project with a presentedAt",
    project: { status: "saved", sharing: "private", presentedAt: 1 },
    skipped: false,
  },
] as const;

for (const c of CASES) {
  test(`no public query hands Dan's private values to a manager or a teammate: ${c.name}`, async () => {
    const { t, orgId, as } = await calderLane();
    await t.mutation(internal.seed.clock, { target: "week4" });

    // Dan's own rows take the sentinel before week 4's hour ends, so its
    // snapshot is taken over them; the ids are real Calder Lane ones, so each
    // call's arguments reach the data it would read.
    const ids = await t.run(async (ctx) => {
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      const dan = people.find((p) => p.email === castOf("dan").email)!;
      const sprint = (await ctx.db
        .query("sprints")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first())!;
      const progress = (await ctx.db
        .query("learningProgress")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", dan._id).eq("sprintId", sprint._id),
        )
        .unique())!;
      await ctx.db.patch(progress._id, {
        sessionsDone: SENTINEL,
        percent: SENTINEL,
      });
      const before = (
        await ctx.db
          .query("surveyResponses")
          .withIndex("by_person_and_sprint", (q) =>
            q.eq("personId", dan._id).eq("sprintId", sprint._id),
          )
          .collect()
      ).filter((r) => r.phase === "before");
      expect(before.length).toBeGreaterThan(0);
      for (const [i, answer] of before.entries()) {
        if (c.skipped) {
          await ctx.db.patch(answer._id, {
            score: undefined,
            skippedAt: SENTINEL,
          });
        } else if (i === 0) {
          await ctx.db.patch(answer._id, { score: SENTINEL });
        }
      }
      const project = (await ctx.db
        .query("projects")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", dan._id).eq("sprintId", sprint._id),
        )
        .unique())!;
      await ctx.db.patch(project._id, { title: TITLE, ...c.project });
      const roles = await ctx.db
        .query("orgRoles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      const invites = await ctx.db
        .query("orgInvites")
        .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
        .collect();
      return {
        orgId,
        roleId: roles.find((r) => r.name === "Employee")!._id,
        personId: dan._id,
        inviteId: invites.find((i) => i.email === castOf("omar").email)!._id,
        storageId: await ctx.storage.store(new Blob(["x"])),
        projectId: project._id,
      };
    });
    await t.mutation(internal.seed.clock, { target: "complete" });

    // The complete steps kept every sentinel, so a clean sweep means something.
    await t.run(async (ctx) => {
      const progress = await ctx.db
        .query("learningProgress")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", ids.personId),
        )
        .unique();
      expect(progress?.sessionsDone).toBe(SENTINEL);
      expect(
        (await ctx.db.query("teamSnapshots").collect()).map((s) => s.week),
      ).toContain(4);
      const project = await ctx.db.get(ids.projectId);
      expect(project).toMatchObject({
        title: TITLE,
        status: c.project.status,
        sharing: c.project.sharing,
      });
      expect(project?.presentedAt).toBe(c.project.presentedAt);
      const badge = await ctx.db
        .query("badges")
        .withIndex("by_person", (q) => q.eq("personId", ids.personId))
        .unique();
      expect(badge).not.toBeNull();
      expect(badge?.reflectionProjectId).toBeUndefined();
      const before = (
        await ctx.db
          .query("surveyResponses")
          .withIndex("by_person_and_sprint", (q) =>
            q.eq("personId", ids.personId),
          )
          .collect()
      ).filter((r) => r.phase === "before");
      if (c.skipped) {
        expect(before.every((r) => r.skippedAt === SENTINEL)).toBe(true);
        expect(before.every((r) => r.score === undefined)).toBe(true);
      } else {
        expect(before.some((r) => r.score === SENTINEL)).toBe(true);
      }
    });

    const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
    const calls: Record<string, Record<string, unknown>> = {
      ...callsFor(ids),
      "orgs:bySlug": { slug: "calder-lane" },
      "badges:publicBySlug": { slug: DAN_SLUG },
    };

    const answered: string[] = [];
    const leaked: string[] = [];
    for (const [who, caller] of [
      ["priya", as("priya")],
      ["lead", lead],
      ["mei", as("mei")],
    ] as const) {
      for (const fn of publicFunctions()) {
        // Mutations are skipped: they write, so sweeping them would change the
        // rows this test reads, and each returns only an id, null or its own
        // result, never another person's rows.
        if (fn.kind !== "query") continue;
        let answer: unknown;
        try {
          answer = await call(caller, fn, calls[fn.name] ?? {});
        } catch {
          // A refusal hands nothing over.
          continue;
        }
        answered.push(`${who} ${fn.name}`);
        if (leaks(JSON.stringify(answer) ?? ""))
          leaked.push(`${who} ${fn.name}`);
      }
    }
    expect(leaked).toEqual([]);
    // The sweep reached the manager's reads and every P6 read, so a clean result means something.
    expect(answered).toEqual(
      expect.arrayContaining([
        "priya manager:overview",
        "lead manager:overview",
        "priya viewer:shell",
        "priya members:list",
        "priya invites:list",
        "priya sprints:launchPage",
        "priya agreements:current",
        "priya invites:teamPreview",
        "priya showAndTell:board",
        "lead showAndTell:board",
        "priya badges:publicBySlug",
        "mei showAndTell:board",
        "mei me:home",
        "mei me:sprint",
        "mei projects:mine",
        "mei badges:mine",
        "mei badges:publicBySlug",
        "mei agreements:forMe",
      ]),
    );
  });
}

/** Where the survey index is defined, and the one module allowed to read it (outcomes, P9). */
const SURVEY_INDEX_FILES = ["tables/sprint.ts", "lib/privacy.ts"];

test("survey answers are read by question only through the privacy layer", () => {
  const dir = new URL("../../convex/", import.meta.url);
  const found: string[] = [];
  for (const file of readdirSync(dir, { recursive: true }) as string[]) {
    if (!file.endsWith(".ts") || file.startsWith("_generated")) continue;
    const source = readFileSync(new URL(file, dir), "utf8");
    if (source.includes("by_sprint_phase_and_question")) found.push(file);
  }
  // Nothing found would pass vacuously; the definition must be seen.
  expect(found).toContain("tables/sprint.ts");
  expect(found.filter((file) => !SURVEY_INDEX_FILES.includes(file))).toEqual(
    [],
  );
});

/**
 * The files that may touch `loadSeated` (raw seated people), `signatureCount`
 * (a live count) or `countSeated` (a count over whatever list it is handed):
 * the privacy layer, the overview and 10's `agreementForViewer`. A new reader
 * of any of them is a new place a manager could see a number, so it has to be
 * added here on purpose.
 */
const SEATED_FILES = ["lib/privacy.ts", "manager.ts", "lib/agreement.ts"];

test("the seated team and the live signature count are read only where the allowlist says", () => {
  const dir = new URL("../../convex/", import.meta.url);
  const found: string[] = [];
  for (const file of readdirSync(dir, { recursive: true }) as string[]) {
    if (!file.endsWith(".ts") || file.startsWith("_generated")) continue;
    const source = readFileSync(new URL(file, dir), "utf8");
    if (/\b(?:loadSeated|signatureCount|countSeated)\b/.test(source)) {
      found.push(file);
    }
  }
  // Nothing found would pass vacuously; both current readers must be seen.
  expect(found).toEqual(
    expect.arrayContaining(["manager.ts", "lib/agreement.ts"]),
  );
  expect(found.filter((file) => !SEATED_FILES.includes(file))).toEqual([]);
});

/**
 * The files that may call the privacy layer's `count` and `aggregate`: its
 * own, and the weekly snapshot writer. A manager query reads `teamSnapshots`
 * instead of counting live (see lib/privacy.ts), so a later phase that needs
 * a live count has to add its file here on purpose.
 */
const PRIVATE_COUNT_FILES = ["lib/privacy.ts", "lib/snapshots.ts"];

test("private activity is counted only where the allowlist says", () => {
  const dir = new URL("../../convex/", import.meta.url);
  // A bare call, not a method such as `.count(`, or a renamed import.
  const calls = /(?<![\w.$])(?:count|aggregate)\(|\b(?:count|aggregate) as\b/;
  // Any import of them, named, renamed or destructured, or the whole module.
  const imports =
    /import\s*\{[^}]*\b(?:count|aggregate)\b[^}]*\}\s*from\s*["'][^"']*privacy["']|import\s*\*\s*as\s+\w+\s+from\s*["'][^"']*privacy["']/;
  const found: string[] = [];
  for (const file of readdirSync(dir, { recursive: true }) as string[]) {
    if (!file.endsWith(".ts") || file.startsWith("_generated")) continue;
    const source = readFileSync(new URL(file, dir), "utf8");
    if (calls.test(source) || imports.test(source)) found.push(file);
  }
  // Nothing found would pass vacuously; the snapshot writer must be seen.
  expect(found).toContain("lib/snapshots.ts");
  expect(found.filter((file) => !PRIVATE_COUNT_FILES.includes(file))).toEqual(
    [],
  );
});
