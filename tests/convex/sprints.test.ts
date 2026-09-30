import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEMO_NOW } from "../../convex/lib/demo/schedule";
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
  vi.unstubAllEnvs();
});

async function sprintOf(t: T, orgId: Id<"orgs">) {
  return (await t.run((ctx) =>
    ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
  ))!;
}

async function eventsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

test("setProtectedHour moves week one with the weekday", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    weekday: 3,
    start: "14:00",
    durationMinutes: 60,
    weeks: 4,
    timeZone: "Australia/Melbourne",
    startDate: "2026-09-09",
    weekOneMonday: "2026-09-07",
    committed: false,
    notReady: false,
    launched: false,
    phase: "draft",
    teamHours: null,
    teamSummary: null,
    courseTitle: "AI Productivity Fundamentals",
  });
  await priya.mutation(api.sprints.setProtectedHour, {
    weekday: 4,
    start: "10:00",
    expectOrgId: orgId,
  });
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    weekday: 4,
    start: "10:00",
    startDate: "2026-09-10",
    weekOneMonday: "2026-09-07",
    committed: false,
  });
  await priya.mutation(api.sprints.setProtectedHour, {
    weekday: 1,
    start: "09:00",
    expectOrgId: orgId,
  });
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    startDate: "2026-09-07",
    weekOneMonday: "2026-09-07",
  });

  // The team line and hours follow the saved profile.
  await priya.mutation(api.teams.saveProfile, {
    sizeBand: "6 to 10",
    teamFunction: "Client service",
    challenges: [],
    finish: false,
    expectOrgId: orgId,
  });
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    teamHours: 8,
    teamSummary: "6 to 10 people, client service",
  });
  await priya.mutation(api.teams.saveProfile, {
    teamFunction: "HR",
    challenges: [],
    finish: false,
    expectOrgId: orgId,
  });
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    teamHours: null,
    teamSummary: "HR",
  });

  for (const bad of [
    { weekday: 0, start: "14:00" },
    { weekday: 6, start: "14:00" },
    { weekday: 2.5, start: "14:00" },
    { weekday: 3, start: "17:00" },
    { weekday: 3, start: "2:00 PM" },
  ]) {
    await expect(
      priya.mutation(api.sprints.setProtectedHour, {
        ...bad,
        expectOrgId: orgId,
      }),
      JSON.stringify(bad),
    ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  }
  expect((await sprintOf(t, orgId)).committedAt).toBeUndefined();
});

test("commit logs hour.committed once", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  await priya.mutation(api.sprints.commit, {
    weekday: 5,
    start: "11:00",
    expectOrgId: orgId,
  });
  const sprint = await sprintOf(t, orgId);
  expect(sprint).toMatchObject({
    committedAt: DEMO_NOW,
    startDate: "2026-09-11",
    protectedHour: { weekday: 5, start: "11:00", durationMinutes: 60 },
  });
  expect(
    (await eventsOf(t, orgId)).map(({ type, at, meta, sprintId }) => ({
      type,
      at,
      meta,
      sprintId,
    })),
  ).toEqual([
    {
      type: "hour.committed",
      at: DEMO_NOW,
      meta: undefined,
      sprintId: sprint._id,
    },
  ]);
  expect((await priya.query(api.sprints.current, {}))?.committed).toBe(true);
  // The setup checklist sees it.
  const shell = await priya.query(api.viewer.shell, {});
  expect(
    shell?.checklist?.items.find((i) => i.label === "Protected hour")?.state,
  ).toBe("done");
});

test("keep exploring records not ready and clears the commitment", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  await priya.mutation(api.sprints.notReady, {
    reason: "Our workload is too high right now",
    choice: "keepExploring",
    expectOrgId: orgId,
  });
  const sprint = await sprintOf(t, orgId);
  expect(sprint.committedAt).toBeUndefined();
  expect(sprint.notReady).toEqual({
    at: DEMO_NOW,
    reason: "Our workload is too high right now",
  });
  expect((await eventsOf(t, orgId)).map((e) => [e.type, e.meta])).toEqual([
    ["hour.committed", undefined],
    [
      "hour.notReady",
      { reason: "Our workload is too high right now", choice: "keepExploring" },
    ],
  ]);
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    committed: false,
    notReady: true,
  });

  // Committing afterwards replaces the "not ready" answer.
  await priya.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    committed: true,
    notReady: false,
  });
});

test("back to scheduling logs the event and changes nothing else", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const before = await sprintOf(t, orgId);
  await priya.mutation(api.sprints.notReady, {
    choice: "backToScheduling",
    expectOrgId: orgId,
  });
  expect(await sprintOf(t, orgId)).toEqual(before);
  expect((await eventsOf(t, orgId)).map((e) => [e.type, e.at, e.meta])).toEqual(
    [
      [
        "hour.notReady",
        DEMO_NOW,
        { reason: "none", choice: "backToScheduling" },
      ],
    ],
  );
});

test("detail is kept only for Something else", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.sprints.notReady, {
    reason: "I need approval from my own manager",
    detail: "My director signs off on schedules",
    choice: "keepExploring",
    expectOrgId: orgId,
  });
  expect((await sprintOf(t, orgId)).notReady).toEqual({
    at: DEMO_NOW,
    reason: "I need approval from my own manager",
  });
  await priya.mutation(api.sprints.notReady, {
    reason: "Something else",
    detail: "  Waiting on a new laptop rollout  ",
    choice: "keepExploring",
    expectOrgId: orgId,
  });
  expect((await sprintOf(t, orgId)).notReady).toEqual({
    at: DEMO_NOW,
    reason: "Something else",
    detail: "Waiting on a new laptop rollout",
  });
  // The words never reach an event.
  const events = await eventsOf(t, orgId);
  expect(JSON.stringify(events)).not.toContain("laptop");

  for (const bad of [
    { reason: "Choose a reason" },
    { reason: "Something else", detail: "x".repeat(501) },
  ]) {
    await expect(
      priya.mutation(api.sprints.notReady, {
        ...bad,
        choice: "keepExploring",
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  }
});

test("setup edits refuse after launch", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const launched = await sprintOf(t, orgId);
  await t.run((ctx) => ctx.db.patch(launched._id, { launchedAt: DEMO_NOW }));
  const hour = { weekday: 4, start: "10:00", expectOrgId: orgId };
  for (const attempt of [
    () => priya.mutation(api.sprints.setProtectedHour, hour),
    () => priya.mutation(api.sprints.commit, hour),
    () =>
      priya.mutation(api.sprints.notReady, {
        choice: "keepExploring",
        expectOrgId: orgId,
      }),
  ]) {
    await expect(attempt()).rejects.toMatchObject({
      data: {
        code: "SPRINT_LAUNCHED",
        message: "Your sprint has already launched.",
      },
    });
  }
  expect(await sprintOf(t, orgId)).toEqual({
    ...launched,
    launchedAt: DEMO_NOW,
  });
  expect(await eventsOf(t, orgId)).toEqual([]);
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    launched: true,
    phase: "scheduled",
  });
});

test("an employee can't set the hour", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as: employee } = await seat(t, orgId, "user_emp", ["members:read"]);
  const hour = { weekday: 3, start: "14:00", expectOrgId: orgId };
  for (const attempt of [
    () => employee.mutation(api.sprints.setProtectedHour, hour),
    () => employee.mutation(api.sprints.commit, hour),
    () =>
      employee.mutation(api.sprints.notReady, {
        choice: "keepExploring",
        expectOrgId: orgId,
      }),
    () =>
      employee.mutation(api.teams.saveProfile, {
        challenges: [],
        finish: true,
        expectOrgId: orgId,
      }),
    () => employee.query(api.sprints.current, {}),
    () => employee.query(api.teams.current, {}),
  ]) {
    await expect(attempt()).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    });
  }
  const sprints = await t.run((ctx) =>
    ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(sprints).toEqual([]);
});

test("current is null for a workspace with no team", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  expect(await owner.query(api.sprints.current, {})).toBeNull();
  await t.run(async (ctx) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    await ctx.db.delete(team!._id);
  });
  expect(await owner.query(api.teams.current, {})).toBeNull();
  expect(await owner.query(api.sprints.current, {})).toBeNull();
  // Nothing to set the hour for.
  await expect(
    owner.mutation(api.sprints.commit, {
      weekday: 3,
      start: "14:00",
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
});

test("committing again after not ready logs hour.committed once", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const hour = { weekday: 3, start: "14:00", expectOrgId: orgId };
  await priya.mutation(api.sprints.commit, hour);
  await priya.mutation(api.sprints.notReady, {
    choice: "keepExploring",
    expectOrgId: orgId,
  });
  await priya.mutation(api.sprints.commit, hour);
  const types = (await eventsOf(t, orgId)).map((e) => e.type);
  expect(types.filter((x) => x === "hour.committed")).toHaveLength(1);
});
