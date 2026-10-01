import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { castOf } from "../../convex/lib/demo/cast";
import { call, callsFor, publicFunctions } from "./sweep";
import { calderLane, seat } from "./workspace/helpers";

/**
 * THE PRIVACY CANARY (spec 5.1). Dan's private rows hold a value nothing else
 * in the demo holds. No public query may hand it to a manager, whether the
 * owner (every permission) or a custom role holding only `team:insights`.
 */

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const SENTINEL = 4242;
const TITLE = "CANARY-DAN-PRIVATE";

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

test("no public query hands Dan's private values to a manager", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week4" });

  // Dan's own rows take the sentinel before week 4's hour ends, so its
  // snapshot is taken over them; the ids are real Calder Lane ones, so each
  // call's arguments reach the data it would read. The complete steps keep
  // them: progress only rises, and a private draft is never presented.
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
    const answer = (await ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", dan._id).eq("sprintId", sprint._id),
      )
      .first())!;
    await ctx.db.patch(answer._id, { score: SENTINEL });
    const project = (await ctx.db
      .query("projects")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", dan._id).eq("sprintId", sprint._id),
      )
      .unique())!;
    await ctx.db.patch(project._id, {
      title: TITLE,
      status: "draft",
      sharing: "private",
    });
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
    };
  });
  await t.mutation(internal.seed.clock, { target: "complete" });
  // Still there after the complete steps, and week 4's snapshot is in.
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("learningProgress")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", ids.personId))
      .unique();
    expect(progress?.sessionsDone).toBe(SENTINEL);
    expect(
      (await ctx.db.query("teamSnapshots").collect()).map((s) => s.week),
    ).toContain(4);
  });
  const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
  const calls: Record<string, Record<string, unknown>> = {
    ...callsFor(ids),
    "orgs:bySlug": { slug: "calder-lane" },
  };

  const answered: string[] = [];
  const leaked: string[] = [];
  for (const [who, caller] of [
    ["priya", as("priya")],
    ["lead", lead],
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
      if (leaks(JSON.stringify(answer) ?? "")) leaked.push(`${who} ${fn.name}`);
    }
  }
  expect(leaked).toEqual([]);
  // The sweep reached the manager's reads, so a clean result means something.
  expect(answered).toEqual(
    expect.arrayContaining([
      "priya manager:overview",
      "lead manager:overview",
      "priya viewer:shell",
      "priya members:list",
      "priya invites:list",
      "priya sprints:launchPage",
      "priya agreements:current",
    ]),
  );
});

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
