import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf, type CastKey } from "../../convex/lib/demo/cast";
import { mel, type DemoTarget } from "../../convex/lib/demo/schedule";
import {
  MAX_SCREENSHOT_BYTES,
  screenshotProblem,
} from "../../convex/lib/projectLimits";
import {
  calderLane,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const move = (t: T, target: DemoTarget) =>
  t.mutation(internal.seed.clock, { target });

async function personOf(t: T, orgId: Id<"orgs">, key: CastKey) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

async function projectsOf(t: T, personId: Id<"people">) {
  return await t.run((ctx) =>
    ctx.db
      .query("projects")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", personId))
      .collect(),
  );
}

async function eventsOf(t: T, orgId: Id<"orgs">, type: string) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("events")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).filter((e) => e.type === type),
  );
}

/**
 * A file as an upload leaves it. convex-test's `storage.store` drops the
 * Blob's type (orgs.test.ts says so), but it does let a test write the type
 * onto the `_storage` row, which real Convex never allows. This is the only
 * way to reach the accept, replace and size paths of `setScreenshot`.
 */
async function upload(t: T, contentType: string, bytes = 16) {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob([new Uint8Array(bytes)]));
    const writer = ctx.db as unknown as {
      patch(id: Id<"_storage">, value: { contentType: string }): Promise<void>;
    };
    await writer.patch(id, { contentType });
    return id;
  });
}
const gone = (t: T, id: Id<"_storage">) =>
  t.run(async (ctx) => (await ctx.db.system.get(id)) === null);

const DRAFT = {
  title: "Weekly client report",
  before: "About two hours by hand.",
  change: "",
  after: "",
  resultTypes: [] as string[],
  headline: "",
  humanReviewed: false,
  dataSafe: false,
};
const READY = {
  ...DRAFT,
  change: "A reusable prompt, then I check every figure.",
  after: "About 1 hour 20 minutes.",
  resultTypes: ["Time saved"],
  headline: "40 minutes saved per week",
  humanReviewed: true,
  dataSafe: true,
};

test("screenshotProblem is the one rule, for the browser and the server", () => {
  expect(screenshotProblem("image/png", 10)).toBeNull();
  expect(screenshotProblem("image/jpeg", MAX_SCREENSHOT_BYTES)).toBeNull();
  expect(screenshotProblem("image/svg+xml", 10)?.code).toBe("SCREENSHOT_TYPE");
  expect(screenshotProblem(undefined, 10)?.code).toBe("SCREENSHOT_TYPE");
  expect(screenshotProblem("image/png", MAX_SCREENSHOT_BYTES + 1)?.code).toBe(
    "SCREENSHOT_SIZE",
  );
});

test("without a sprint there is no project to read or write", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as: dan } = await seat(t, orgId, "user_dan", []);
  expect(await dan.query(api.projects.mine, {})).toBeNull();
  await expect(
    dan.mutation(api.projects.saveDraft, { ...DRAFT, expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "NO_SPRINT" } });
});

test("a draft upserts one private row and records the week it started", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const dan = as("dan");
  expect(await dan.query(api.projects.mine, {})).toEqual({
    week: 1,
    project: null,
  });

  await dan.mutation(api.projects.saveDraft, { ...DRAFT, expectOrgId: orgId });
  await dan.mutation(api.projects.saveDraft, {
    ...DRAFT,
    title: "Weekly report, second go",
    expectOrgId: orgId,
  });

  const rows = await projectsOf(t, await personOf(t, orgId, "dan"));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    title: "Weekly report, second go",
    status: "draft",
    sharing: "private",
    startedWeek: 1,
  });
  expect(await dan.query(api.projects.mine, {})).toEqual({
    week: 1,
    project: {
      ...DRAFT,
      title: "Weekly report, second go",
      status: "draft",
      presented: false,
      learned: "",
      howChecked: "",
      screenshotUrl: null,
      // The demo clock is 1:00 PM on Wednesday 9 September, Melbourne.
      autosavedLabel: "Draft saved at 1:00 PM",
    },
  });
  // A draft is nobody's news: nothing is logged.
  expect(await eventsOf(t, orgId, "project.saved")).toEqual([]);
});

test("save needs a title and both checks, and logs project.saved once", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const dan = as("dan");
  const expectOrgId = orgId;
  const refused = (args: typeof READY, code: string) =>
    expect(
      dan.mutation(api.projects.save, { ...args, expectOrgId }),
    ).rejects.toMatchObject({ data: { code } });

  await refused({ ...READY, title: "   " }, "PROJECT_TITLE_REQUIRED");
  await refused({ ...READY, dataSafe: false }, "PROJECT_CHECKS_REQUIRED");
  await refused({ ...READY, humanReviewed: false }, "PROJECT_CHECKS_REQUIRED");
  await refused({ ...READY, title: "x".repeat(121) }, "PROJECT_TOO_LONG");
  await refused({ ...READY, after: "x".repeat(2001) }, "PROJECT_TOO_LONG");
  await refused({ ...READY, headline: "x".repeat(161) }, "PROJECT_TOO_LONG");
  // A refusal writes nothing.
  expect(await projectsOf(t, await personOf(t, orgId, "dan"))).toEqual([]);

  // Unknown or repeated result types are dropped, in the form's order.
  await dan.mutation(api.projects.save, {
    ...READY,
    resultTypes: ["Other", "Made up", "Time saved", "Other"],
    expectOrgId,
  });
  expect((await dan.query(api.projects.mine, {}))!.project).toMatchObject({
    status: "saved",
    resultTypes: ["Time saved", "Other"],
    presented: false,
    autosavedLabel: "Saved at 1:00 PM",
  });
  // after, resultTypes and headline: the three the script counts.
  expect(
    (await eventsOf(t, orgId, "project.saved")).map((e) => e.meta),
  ).toEqual([{ fieldsFilled: 3 }]);

  // A partial save counts only what is filled.
  await as("mei").mutation(api.projects.save, {
    ...DRAFT,
    after: "Done the same day.",
    humanReviewed: true,
    dataSafe: true,
    expectOrgId,
  });
  expect(
    (await eventsOf(t, orgId, "project.saved")).map((e) => e.meta),
  ).toEqual([{ fieldsFilled: 3 }, { fieldsFilled: 1 }]);

  // An edit through Save project is the same project, not a second save.
  await dan.mutation(api.projects.save, {
    ...READY,
    headline: "",
    expectOrgId,
  });
  expect(await eventsOf(t, orgId, "project.saved")).toHaveLength(2);

  // A late autosave can't undo a save (Ruling 12).
  await dan.mutation(api.projects.saveDraft, { ...DRAFT, expectOrgId });
  expect((await dan.query(api.projects.mine, {}))!.project).toMatchObject({
    status: "saved",
    title: READY.title,
    after: READY.after,
    headline: "",
  });
});

test("a reflection and presenting need a saved project; presenting once is enough", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const dan = as("dan");
  const expectOrgId = orgId;
  await dan.mutation(api.projects.saveDraft, { ...DRAFT, expectOrgId });

  await expect(
    dan.mutation(api.projects.saveReflection, {
      learned: "Check every figure.",
      howChecked: "Against the source.",
      expectOrgId,
    }),
  ).rejects.toMatchObject({ data: { code: "PROJECT_NOT_SAVED" } });
  await expect(
    dan.mutation(api.projects.present, { expectOrgId }),
  ).rejects.toMatchObject({ data: { code: "PROJECT_NOT_SAVED" } });

  await dan.mutation(api.projects.save, { ...READY, expectOrgId });
  await dan.mutation(api.projects.saveReflection, {
    learned: "  Check every figure.  ",
    howChecked: "Against the source.",
    expectOrgId,
  });
  await expect(
    dan.mutation(api.projects.saveReflection, {
      learned: "x".repeat(2001),
      howChecked: "",
      expectOrgId,
    }),
  ).rejects.toMatchObject({ data: { code: "PROJECT_TOO_LONG" } });
  expect((await dan.query(api.projects.mine, {}))!.project).toMatchObject({
    learned: "Check every figure.",
    howChecked: "Against the source.",
  });

  await dan.mutation(api.projects.present, { expectOrgId });
  await dan.mutation(api.projects.present, { expectOrgId });
  const [row] = await projectsOf(t, await personOf(t, orgId, "dan"));
  expect(row).toMatchObject({
    sharing: "team",
    presentedAt: mel("2026-09-09T13:00"),
  });
  expect(await eventsOf(t, orgId, "project.presented")).toHaveLength(1);
  expect((await dan.query(api.projects.mine, {}))!.project!.presented).toBe(
    true,
  );
});

test("a screenshot is a PNG or JPG up to 5 MB, and a replacement deletes the old file", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const dan = as("dan");
  const expectOrgId = orgId;
  const set = (storageId: Id<"_storage"> | null) =>
    dan.mutation(api.projects.setScreenshot, { storageId, expectOrgId });

  const first = await upload(t, "image/png");
  // No project yet: nowhere to put it.
  await expect(set(first)).rejects.toMatchObject({
    data: { code: "PROJECT_MISSING" },
  });
  await dan.mutation(api.projects.saveDraft, { ...DRAFT, expectOrgId });

  await expect(set(await upload(t, "image/svg+xml"))).rejects.toMatchObject({
    data: { code: "SCREENSHOT_TYPE" },
  });
  await expect(
    set(await upload(t, "image/png", MAX_SCREENSHOT_BYTES + 1)),
  ).rejects.toMatchObject({ data: { code: "SCREENSHOT_SIZE" } });

  await set(first);
  expect(
    (await dan.query(api.projects.mine, {}))!.project!.screenshotUrl,
  ).toEqual(expect.any(String));
  // A refused replacement keeps the current file.
  await expect(set(await upload(t, "image/svg+xml"))).rejects.toMatchObject({
    data: { code: "SCREENSHOT_TYPE" },
  });
  expect(await gone(t, first)).toBe(false);

  const second = await upload(t, "image/jpeg");
  await set(second);
  expect(await gone(t, first)).toBe(true);
  const [row] = await projectsOf(t, await personOf(t, orgId, "dan"));
  expect(row!.screenshotId).toBe(second);

  await set(null);
  expect(await gone(t, second)).toBe(true);
  expect(
    (await dan.query(api.projects.mine, {}))!.project!.screenshotUrl,
  ).toBeNull();
});

test("an upload older than 15 minutes is refused", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const dan = as("dan");
  const expectOrgId = orgId;
  await dan.mutation(api.projects.saveDraft, { ...DRAFT, expectOrgId });
  const old = await upload(t, "image/png");
  // The wall clock, not the demo clock: the file was stored in real time.
  // Forward only: convex-test's creation times never go backwards.
  vi.setSystemTime(Date.now() + 16 * 60_000);
  await expect(
    dan.mutation(api.projects.setScreenshot, { storageId: old, expectOrgId }),
  ).rejects.toMatchObject({ data: { code: "SCREENSHOT_STALE" } });
  const [row] = await projectsOf(t, await personOf(t, orgId, "dan"));
  expect(row!.screenshotId).toBeUndefined();
});
