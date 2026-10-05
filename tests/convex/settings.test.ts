import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEFAULT_SETTINGS } from "../../convex/lib/settings";
import { snapshotSeries } from "../../convex/lib/snapshots";
import { DEFAULT_TIME_ZONE } from "../../convex/lib/orgs/people";
import { TIME_ZONES, TIME_ZONE_LABELS } from "../../convex/lib/profileFields";
import { calderLane, harness, workspace, type T } from "./workspace/helpers";
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

const PROFILE = {
  name: "Pat Lee",
  jobTitle: "Operations lead",
  timeZone: "Australia/Perth",
  captionsByDefault: false,
  reduceMotion: true,
} as const;

/** The minute past the hour in `zone` at `at`: 0 for a whole-hour zone. */
const minuteIn = (zone: string, at: number) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .find((part) => part.type === "minute")!.value,
  );

test("every zone on the list is a whole number of hours from UTC, winter and summer (R-h)", () => {
  const january = Date.UTC(2026, 0, 15);
  const july = Date.UTC(2026, 6, 15);
  // The check can fail: Adelaide is half an hour off.
  expect(minuteIn("Australia/Adelaide", january)).toBe(30);
  for (const zone of TIME_ZONES) {
    expect([zone, minuteIn(zone, january), minuteIn(zone, july)]).toEqual([
      zone,
      0,
      0,
    ]);
  }
  expect(Object.keys(TIME_ZONE_LABELS).sort()).toEqual([...TIME_ZONES].sort());
  // Every seat starts on the default, so every Profile form opens on the list.
  expect(TIME_ZONES).toContain(DEFAULT_TIME_ZONE);
});

test("saveProfile writes the seat, the account name and the row, never a sprint", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  // A launched sprint in Melbourne, as Priya's would be.
  await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.insert("sprints", {
      orgId,
      teamId: team._id,
      startDate: "2026-09-09",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: "AI Productivity Fundamentals",
      launchedAt: 1,
      createdAt: 1,
    });
  });
  const sprintsOf = () =>
    t.run((ctx) =>
      ctx.db
        .query("sprints")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
    );
  const before = await sprintsOf();

  await owner.mutation(api.settings.saveProfile, {
    ...PROFILE,
    name: "  Pat Lee  ",
    expectOrgId: orgId,
  });

  const after = await t.run(async (ctx) => ({
    person: await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
    profile: await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", "user_owner"))
      .unique(),
    settings: await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  }));
  expect(after.person).toMatchObject({
    name: "Pat Lee",
    initials: "PL",
    jobTitle: "Operations lead",
    timeZone: "Australia/Perth",
  });
  expect(after.profile?.displayName).toBe("Pat Lee");
  expect(after.settings).toHaveLength(1);
  expect(after.settings[0]).toMatchObject({
    captionsByDefault: false,
    reduceMotion: true,
    weeklyReminder: true,
  });
  // R-h: the launched sprint keeps its zone, and no sprint is written at all.
  expect(await sprintsOf()).toEqual(before);
});

test("saveProfile refuses a blank or long name, a long job title and a half-hour zone", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const save = (over: Record<string, unknown>) =>
    owner.mutation(api.settings.saveProfile, {
      ...PROFILE,
      expectOrgId: orgId,
      ...over,
    } as never);
  // Blank and long names are refused by the handler, a half-hour zone by the validator.
  await expect(save({ name: "   " })).rejects.toMatchObject({
    data: { code: "NAME_REQUIRED", message: "A name is required." },
  });
  await expect(save({ name: "x".repeat(41) })).rejects.toMatchObject({
    data: { code: "NAME_REQUIRED" },
  });
  await expect(save({ jobTitle: "x".repeat(61) })).rejects.toMatchObject({
    data: {
      code: "FIELD_REQUIRED",
      message: "A job title can be at most 60 characters.",
    },
  });
  // R-h: the validator itself refuses a half-hour zone.
  await expect(save({ timeZone: "Australia/Adelaide" })).rejects.toThrow();
  const person = await t.run((ctx) =>
    ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
  );
  expect(person?.timeZone).toBe("Australia/Melbourne");
});

test("a profile save and a toggle share the one row", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await owner.mutation(api.settings.setToggle, {
    key: "showAndTellReminder",
    on: false,
    expectOrgId: orgId,
  });
  await owner.mutation(api.settings.saveProfile, {
    ...PROFILE,
    expectOrgId: orgId,
  });
  const rows = await t.run((ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    showAndTellReminder: false,
    reduceMotion: true,
  });
});
