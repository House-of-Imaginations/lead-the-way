import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { TimeZone } from "../../../convex/lib/profileFields";
import { snapshotSeries } from "../../../convex/lib/snapshots";
import { launchedSprint } from "../../../convex/lib/sprint";
import { dayOf, mondayOf } from "../../../convex/lib/sprintTime";
import { move, personOf, sprintsOf } from "../sprintHelpers";
import { calderLane, harness, seat, workspace } from "./helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test("18's functions need org:manage, and nobody else reads or writes them", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const { as: employee } = await seat(t, orgId, "user_employee", []);
  // Every permission but org:manage: a lead is not the workspace's owner.
  const { as: lead } = await seat(t, orgId, "user_lead", [
    "members:read",
    "members:manage",
    "roles:manage",
    "sprint:manage",
    "team:insights",
  ]);
  for (const who of [employee, lead]) {
    await expect(who.query(api.workspace.settings, {})).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    });
    await expect(
      who.mutation(api.workspace.setThreshold, {
        threshold: 6,
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(
      who.mutation(api.workspace.saveGeneral, {
        name: "Aster Network",
        teamName: "Your team",
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(
      who.mutation(api.workspace.saveSprintDefaults, {
        weekday: 3,
        start: "14:00",
        timeZone: "Australia/Melbourne",
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  }
  expect(await owner.query(api.workspace.settings, {})).toMatchObject({
    name: "Aster Network",
    slug: "aster-network",
    partner: null,
    owner: "Someone",
    teamName: "Your team",
    industry: null,
    teamFunction: null,
    course: "AI Productivity Fundamentals",
    threshold: 5,
  });
});

test("Calder Lane's partner and owner read as 18 shows them", async () => {
  const { as } = await calderLane();
  expect(await as("priya").query(api.workspace.settings, {})).toMatchObject({
    name: "Calder Lane",
    slug: "calder-lane",
    partner: "Southbank Business Collective, delivered with IBM SkillsBuild",
    owner: "Priya Raman",
    teamName: "Client Services team",
  });
});

test("the threshold can't be set below 5, above 10 or between whole numbers", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  for (const threshold of [4, 11, 5.5, Number.NaN]) {
    await expect(
      owner.mutation(api.workspace.setThreshold, {
        threshold,
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "FIELD_REQUIRED",
        message: "Choose a threshold from 5 to 10.",
      },
    });
  }
  await owner.mutation(api.workspace.setThreshold, {
    threshold: 10,
    expectOrgId: orgId,
  });
  expect((await owner.query(api.workspace.settings, {})).threshold).toBe(10);
});

// A regression pin: today's logic already keeps comparability off the
// threshold. It is here so a later change to `setThreshold` can't break it.
test("a threshold change mid-sprint changes no row's comparability (Ruling FX)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week3");
  await as("priya").mutation(api.workspace.setThreshold, {
    threshold: 8,
    expectOrgId: orgId,
  });
  await move(t, "week4");
  const priya = await personOf(t, orgId, "priya");
  const { weeks } = await t.run(async (ctx) =>
    snapshotSeries(ctx, (await launchedSprint(ctx, orgId))!, priya),
  );
  // Every row taken so far, the one under 8 included, still compares.
  expect(weeks.length).toBeGreaterThan(1);
  expect(weeks.map((w) => w.comparable).every(Boolean)).toBe(true);
  expect(weeks.at(-1)!.row.threshold).toBe(8);
  expect(weeks.slice(0, -1).every((w) => w.row.threshold === 5)).toBe(true);
  // Seven are seated, so at 8 the newest week hides: by the threshold,
  // never as a change to who is counted.
  expect(
    (await as("priya").query(api.manager.overview, {}))?.team?.sessionDone.stat,
  ).toEqual({ kind: "hidden", helper: "Hidden until 8 responses" });
});

test("General saves the workspace and team names and the team's profile, never the slug", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await owner.mutation(api.workspace.saveGeneral, {
    name: "Aster Studio  ",
    teamName: "  Client services",
    industry: "Marketing",
    teamFunction: "Client service",
    expectOrgId: orgId,
  });
  expect(await owner.query(api.workspace.settings, {})).toMatchObject({
    name: "Aster Studio",
    slug: "aster-network",
    teamName: "Client services",
    industry: "Marketing",
    teamFunction: "Client service",
  });
});

test("General says how to fix a name, refuses a choice off the list, and writes nothing", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const save = (patch: Record<string, string>) =>
    owner.mutation(api.workspace.saveGeneral, {
      name: "Aster",
      teamName: "Team",
      expectOrgId: orgId,
      ...patch,
    });
  for (const [patch, code] of [
    [{ name: " " }, "ORG_NAME_REQUIRED"],
    [{ name: "x".repeat(61) }, "ORG_NAME_REQUIRED"],
    [{ teamName: " " }, "NAME_REQUIRED"],
    [{ teamName: "x".repeat(61) }, "NAME_REQUIRED"],
    [{ industry: "Mining" }, "FIELD_REQUIRED"],
    [{ teamFunction: "Sales" }, "FIELD_REQUIRED"],
  ] as const) {
    await expect(save(patch), JSON.stringify(patch)).rejects.toMatchObject({
      data: { code },
    });
  }
  expect(await owner.query(api.workspace.settings, {})).toMatchObject({
    name: "Aster Network",
    teamName: "Your team",
  });
  const { as: lead } = await seat(t, orgId, "user_lead", ["sprint:manage"]);
  await expect(
    lead.mutation(api.workspace.saveGeneral, {
      name: "Aster",
      teamName: "Team",
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});

const DEFAULTS = (weekday: number, start: string, timeZone: TimeZone) => ({
  weekday,
  start,
  timeZone,
});

test("saving defaults makes no sprint, and the first sprint takes their day and zone", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  // Nothing saved and no sprint: Wednesday 2:00 PM in the owner's zone.
  expect(
    (await owner.query(api.workspace.settings, {})).sprintDefaults,
  ).toEqual(DEFAULTS(3, "14:00", "Australia/Melbourne"));

  await owner.mutation(api.workspace.saveSprintDefaults, {
    ...DEFAULTS(2, "10:00", "Europe/London"),
    expectOrgId: orgId,
  });
  expect(await sprintsOf(t, orgId)).toEqual([]);
  expect(
    (await owner.query(api.workspace.settings, {})).sprintDefaults,
  ).toEqual(DEFAULTS(2, "10:00", "Europe/London"));

  // 04 makes the draft, in the defaults' zone, not the owner's.
  await owner.mutation(api.sprints.notReady, {
    choice: "keepExploring",
    expectOrgId: orgId,
  });
  const [sprint] = await sprintsOf(t, orgId);
  expect(sprint).toMatchObject({
    timeZone: "Europe/London",
    protectedHour: { weekday: 2, start: "10:00", durationMinutes: 60 },
  });
  expect(dayOf(sprint!.startDate)).toBe(2);
});

test("with a draft open, saving moves its hour and zone and keeps its commitment", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await owner.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  const [before] = await sprintsOf(t, orgId);
  await owner.mutation(api.workspace.saveSprintDefaults, {
    ...DEFAULTS(5, "09:00", "Asia/Tokyo"),
    expectOrgId: orgId,
  });
  const after = await sprintsOf(t, orgId);
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({
    _id: before!._id,
    timeZone: "Asia/Tokyo",
    protectedHour: { weekday: 5, start: "09:00", durationMinutes: 60 },
    committedAt: before!.committedAt,
  });
  expect(dayOf(after[0]!.startDate)).toBe(5);
});

test("saving defaults mid-sprint leaves the launched sprint alone and makes no sprint", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const before = await sprintsOf(t, orgId);
  await as("priya").mutation(api.workspace.saveSprintDefaults, {
    ...DEFAULTS(1, "09:00", "UTC"),
    expectOrgId: orgId,
  });
  expect(await sprintsOf(t, orgId)).toEqual(before);
  // The launched sprint keeps its Wednesday in Melbourne; the defaults moved.
  expect(before.at(-1)).toMatchObject({
    timeZone: "Australia/Melbourne",
    protectedHour: { weekday: 3 },
  });
  expect(await as("priya").query(api.workspace.settings, {})).toMatchObject({
    sprintDefaults: DEFAULTS(1, "09:00", "UTC"),
    canSetDefaults: true,
  });
});

test("with a clone in setup, defaults rewrite only the clone (one-draft rule)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "complete");
  const priya = as("priya");
  // Saved before the clone: Run another sprint starts from them.
  await priya.mutation(api.workspace.saveSprintDefaults, {
    ...DEFAULTS(2, "11:00", "Australia/Perth"),
    expectOrgId: orgId,
  });
  await priya.mutation(api.sprints.runAnother, { expectOrgId: orgId });
  const [first, clone] = await sprintsOf(t, orgId);
  expect(clone).toMatchObject({
    timeZone: "Australia/Perth",
    protectedHour: { weekday: 2, start: "11:00" },
  });
  expect(dayOf(clone!.startDate)).toBe(2);

  // Saved again with the clone open: only the clone moves, within its week.
  await priya.mutation(api.workspace.saveSprintDefaults, {
    ...DEFAULTS(4, "09:00", "UTC"),
    expectOrgId: orgId,
  });
  const after = await sprintsOf(t, orgId);
  expect(after).toHaveLength(2);
  expect(after[0]).toEqual(first);
  expect(after[1]).toMatchObject({
    _id: clone!._id,
    timeZone: "UTC",
    protectedHour: { weekday: 4, start: "09:00" },
  });
  expect(mondayOf(after[1]!.startDate)).toBe(mondayOf(clone!.startDate));
  // launchedSprint reads the two newest, so with one draft on top it still
  // finds sprint 1; a second draft is refused.
  expect(await t.run((ctx) => launchedSprint(ctx, orgId))).toMatchObject({
    _id: first!._id,
  });
  await expect(
    priya.mutation(api.sprints.runAnother, { expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "SPRINT_DRAFT_EXISTS" } });
});

test("defaults are checked, and need sprint:manage as well as org:manage", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  for (const [weekday, start] of [
    [6, "14:00"],
    [3, "13:15"],
  ] as const) {
    await expect(
      owner.mutation(api.workspace.saveSprintDefaults, {
        ...DEFAULTS(weekday, start, "UTC"),
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  }
  const { as: admin } = await seat(t, orgId, "user_admin", ["org:manage"]);
  // 18 opens for org:manage alone, but its Sprint defaults can't be saved.
  expect((await admin.query(api.workspace.settings, {})).canSetDefaults).toBe(
    false,
  );
  await expect(
    admin.mutation(api.workspace.saveSprintDefaults, {
      ...DEFAULTS(3, "14:00", "UTC"),
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  // org:manage alone may still set the threshold.
  await expect(
    admin.mutation(api.workspace.setThreshold, {
      threshold: 6,
      expectOrgId: orgId,
    }),
  ).resolves.toBeNull();
});
