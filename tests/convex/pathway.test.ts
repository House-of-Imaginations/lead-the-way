import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { coachingPercent, type ModuleKey } from "../../convex/lib/pathway";
import { DEFAULT_SETTINGS } from "../../convex/lib/settings";
import { personFields } from "./testHelpers";
import { calderLane, harness, workspace, type T } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const REQUIRED = [
  "shared-norms",
  "without-micromanaging",
  "team-agreement",
] as const;

const row = (moduleKey: string, minutesWatched: number) =>
  ({ moduleKey, minutesWatched }) as Doc<"pathwayProgress">;

/** A fresh workspace; its owner holds every permission. */
async function manager() {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const complete = (moduleKey: ModuleKey) =>
    owner.mutation(api.pathway.completeModule, {
      moduleKey,
      expectOrgId: orgId,
    });
  return { t, owner, orgId, complete };
}

/** A seat on the workspace's own Employee role, which grants nothing. */
async function employee(t: T, orgId: Id<"orgs">) {
  await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const role = roles.find((r) => r.name === "Employee")!;
    await ctx.db.insert("people", {
      orgId,
      roleId: role._id,
      ...personFields("user_emp"),
    });
  });
  return t.withIdentity({ subject: "user_emp" });
}

async function progressOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("pathwayProgress")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

async function eventsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

test("modules complete in order within a path", async () => {
  const { owner, complete } = await manager();
  const outOfOrder = {
    data: { code: "FORBIDDEN", message: "Finish the earlier modules first." },
  };
  await expect(complete("without-micromanaging")).rejects.toMatchObject(
    outOfOrder,
  );
  await expect(complete("coaching-first-task")).rejects.toMatchObject(
    outOfOrder,
  );

  await complete("shared-norms");
  // Each path keeps its own order: coaching doesn't wait for the required path.
  await complete("coaching-conversations");
  await complete("without-micromanaging");

  const page = await owner.query(api.pathway.forViewer, {});
  expect(page.modules.map((m) => [m.key, m.done, m.unlocked])).toEqual([
    ["shared-norms", true, true],
    ["without-micromanaging", true, true],
    ["team-agreement", false, true],
    ["coaching-conversations", true, true],
    ["coaching-first-task", false, true],
    ["coaching-feedback", false, false],
    ["coaching-habit", false, false],
  ]);
  expect(page.required).toEqual({ done: 2, total: 3 });
});

test("completing a module credits its full minutes and logs once", async () => {
  const { t, orgId, complete } = await manager();
  await complete("shared-norms");
  await complete("shared-norms"); // idempotent

  // A partly watched module is credited in full when completed.
  const personId = await t.run(
    async (ctx) =>
      (await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique())!._id,
  );
  await t.run((ctx) =>
    ctx.db.insert("pathwayProgress", {
      orgId,
      personId,
      moduleKey: "without-micromanaging",
      minutesWatched: 3,
    }),
  );
  await complete("without-micromanaging");

  const rows = await progressOf(t, orgId);
  expect(rows.map((r) => [r.moduleKey, r.minutesWatched])).toEqual([
    ["shared-norms", 5],
    ["without-micromanaging", 10],
  ]);
  expect(rows.every((r) => typeof r.completedAt === "number")).toBe(true);
  const completed = (await eventsOf(t, orgId)).filter(
    (e) => e.type === "pathway.completed",
  );
  expect(completed.map((e) => e.meta)).toEqual([
    { moduleKey: "shared-norms" },
    { moduleKey: "without-micromanaging" },
  ]);
});

test("coaching percent counts only the coaching path", async () => {
  expect(
    coachingPercent([
      row("coaching-conversations", 15),
      row("coaching-first-task", 15),
      row("coaching-feedback", 9),
    ]),
  ).toBe(65);
  expect(coachingPercent([])).toBe(0);
  // A module never counts past its own length.
  expect(coachingPercent([row("coaching-habit", 40)])).toBe(25);

  // The demo's week 2, through the query: Priya watched 15, 15 and 9 minutes.
  const { t, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week2" });
  expect(await as("priya").query(api.pathway.forViewer, {})).toMatchObject({
    required: { done: 3, total: 3 },
    coachingPercent: 65,
    afterConfidence: 4,
  });
});

test("required modules never move the coaching percent", async () => {
  const { owner, complete } = await manager();
  for (const key of REQUIRED) await complete(key);
  const page = await owner.query(api.pathway.forViewer, {});
  expect(page.required).toEqual({ done: 3, total: 3 });
  expect(page.coachingPercent).toBe(0);
  expect(
    coachingPercent([
      row("shared-norms", 5),
      row("without-micromanaging", 10),
      row("team-agreement", 10),
    ]),
  ).toBe(0);
});

test("the after rating needs the required path", async () => {
  const { t, owner, orgId, complete } = await manager();
  const rate = (score: number) =>
    owner.mutation(api.pathway.rateConfidence, { score, expectOrgId: orgId });

  await expect(rate(4)).rejects.toMatchObject({
    data: { code: "FORBIDDEN", message: "Finish the required modules first." },
  });
  for (const key of REQUIRED) await complete(key);
  for (const bad of [0, 6, 3.5]) {
    await expect(rate(bad), String(bad)).rejects.toMatchObject({
      data: { code: "FIELD_REQUIRED" },
    });
  }
  await rate(4);
  await rate(5); // a second rating replaces the first

  expect((await owner.query(api.pathway.forViewer, {})).afterConfidence).toBe(
    5,
  );
  const answers = await t.run((ctx) =>
    ctx.db
      .query("surveyResponses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(answers.map((a) => [a.phase, a.question, a.score])).toEqual([
    ["after", "normsConfidence", 5],
  ]);
  // The side nav checklist reads the same rule.
  const shell = await owner.query(api.viewer.shell, {});
  expect(shell?.checklist?.items[2]).toMatchObject({
    label: "Manager pathway",
    state: "done",
  });
});

test("an employee can't complete a module", async () => {
  const { t, orgId } = await manager();
  const emp = await employee(t, orgId);
  const calls = [
    () =>
      emp.mutation(api.pathway.completeModule, {
        moduleKey: "shared-norms",
        expectOrgId: orgId,
      }),
    () =>
      emp.mutation(api.pathway.rateConfidence, {
        score: 4,
        expectOrgId: orgId,
      }),
    () => emp.query(api.pathway.forViewer, {}),
  ];
  for (const call of calls) {
    await expect(call()).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  }
  expect(await progressOf(t, orgId)).toEqual([]);
});

test("forViewer says when the sprint has launched (Ruling 16)", async () => {
  const { owner } = await manager();
  // A fresh workspace has no launched sprint.
  expect((await owner.query(api.pathway.forViewer, {})).launched).toBe(false);

  const { t, as } = await calderLane();
  expect((await as("priya").query(api.pathway.forViewer, {})).launched).toBe(
    false,
  );
  await t.mutation(internal.seed.clock, { target: "week1" });
  expect((await as("priya").query(api.pathway.forViewer, {})).launched).toBe(
    true,
  );
});

test("05's player follows the viewer's captions setting (P7b-1)", async () => {
  const { t, owner, orgId } = await manager();
  expect((await owner.query(api.pathway.forViewer, {})).captionsByDefault).toBe(
    true,
  );
  await t.run(async (ctx) => {
    const person = (await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.insert("settings", {
      orgId,
      personId: person._id,
      ...DEFAULT_SETTINGS,
      captionsByDefault: false,
    });
  });
  expect((await owner.query(api.pathway.forViewer, {})).captionsByDefault).toBe(
    false,
  );
});
