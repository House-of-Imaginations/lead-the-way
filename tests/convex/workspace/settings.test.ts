import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { snapshotSeries } from "../../../convex/lib/snapshots";
import { launchedSprint } from "../../../convex/lib/sprint";
import { move, personOf } from "../sprintHelpers";
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
  }
  expect(await owner.query(api.workspace.settings, {})).toMatchObject({
    name: "Aster Network",
    slug: "aster-network",
    partner: null,
    owner: expect.any(String),
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
