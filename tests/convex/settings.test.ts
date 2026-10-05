import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEFAULT_SETTINGS } from "../../convex/lib/settings";
import { snapshotSeries } from "../../convex/lib/snapshots";
import { calderLane, type T } from "./workspace/helpers";
import { move, personOf } from "./sprintHelpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const rowsOf = (t: T, personId: Id<"people">) =>
  t.run((ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_person", (q) => q.eq("personId", personId))
      .collect(),
  );

test("mine reads the viewer's own fields, the defaults, the owner's name and the threshold", async () => {
  const { t, as } = await calderLane();
  // Dan has a seat from 8 September.
  await move(t, "week1");
  expect(await as("dan").query(api.settings.mine, {})).toEqual({
    name: "Dan Okafor",
    email: "dan.okafor@calderlane.com.au",
    jobTitle: "Senior Account Executive",
    timeZone: "Australia/Melbourne",
    manager: { name: "Priya Raman", firstName: "Priya" },
    threshold: 5,
    settings: { ...DEFAULT_SETTINGS },
  });
});

test("two writes leave one settings row per person (writer contract 5)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const dan = as("dan");
  const danId = await personOf(t, orgId, "dan");
  await dan.mutation(api.settings.setToggle, {
    key: "weeklyReminder",
    on: false,
    expectOrgId: orgId,
  });
  await dan.mutation(api.settings.setToggle, {
    key: "askBeforeSharing",
    on: false,
    expectOrgId: orgId,
  });
  const rows = await rowsOf(t, danId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    ...DEFAULT_SETTINGS,
    orgId,
    weeklyReminder: false,
    askBeforeSharing: false,
  });
  expect((await dan.query(api.settings.mine, {})).settings).toEqual({
    ...DEFAULT_SETTINGS,
    weeklyReminder: false,
    askBeforeSharing: false,
  });
});

test("a stray second row makes the writer throw rather than write past it", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const danId = await personOf(t, orgId, "dan");
  await t.run(async (ctx) => {
    for (let i = 0; i < 2; i++) {
      await ctx.db.insert("settings", {
        orgId,
        personId: danId,
        ...DEFAULT_SETTINGS,
      });
    }
  });
  await expect(
    as("dan").mutation(api.settings.setToggle, {
      key: "includeInTeamTotals",
      on: false,
      expectOrgId: orgId,
    }),
  ).rejects.toThrow();
  expect(
    (await rowsOf(t, danId)).map((row) => row.includeInTeamTotals),
  ).toEqual([true, true]);
});

test("Ruling FX: opting back in never shows a row taken while opted out", async () => {
  const { t, orgId, as } = await calderLane();
  const toggle = (on: boolean) =>
    as("dan").mutation(api.settings.setToggle, {
      key: "includeInTeamTotals",
      on,
      expectOrgId: orgId,
    });
  // Week 1 is taken with Dan counted.
  await move(t, "week2");
  await toggle(false);
  // Week 2 is taken without him.
  await move(t, "week3");
  await toggle(true);
  // Week 3 counts him again: the first row's group.
  await move(t, "week4");
  const priyaId = await personOf(t, orgId, "priya");
  const comparable = await t.run(async (ctx) => {
    const sprint = (await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    const { weeks } = await snapshotSeries(ctx, sprint, priyaId);
    return weeks.map((row) => row.comparable);
  });
  expect(comparable).toEqual([true, false, true]);
});
