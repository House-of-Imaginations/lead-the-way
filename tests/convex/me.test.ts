import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf, type CastKey } from "../../convex/lib/demo/cast";
import { mel, type DemoTarget } from "../../convex/lib/demo/schedule";
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

/** The demo clock at a Melbourne wall time. The script doesn't run. */
const clockAt = (t: T, orgId: Id<"orgs">, local: string) =>
  t.run((ctx) => ctx.db.patch(orgId, { demoNow: mel(local) }));

async function personOf(t: T, orgId: Id<"orgs">, key: CastKey) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

const names = (w: number) => ({ name: `Week ${w}`, short: `Wk ${w}` });
const done = (w: number) => ({
  ...names(w),
  status: "Done",
  shortStatus: "Done",
  state: "done",
});
const current = (w: number) => ({
  ...names(w),
  status: "In progress",
  shortStatus: "Now",
  state: "current",
});
const todo = (w: number, status: string, shortStatus: string) => ({
  ...names(w),
  status,
  shortStatus,
  state: "todo",
});

const COURSE = "AI Productivity Fundamentals";
const TAG = "Protected time, Wed 2:00 to 3:00 PM";
const NOT_STARTED = { label: "Not started", kind: "gray" };
const ADDED = { label: "Added", kind: "green" };
const AGREEMENT = {
  tools: "Microsoft Copilot, ChatGPT Enterprise",
  neverIn: "Client names, Personal information, Passwords, and 2 more",
  contact: "Ask Priya Raman",
};

const learn = (state: string) => ({ label: "Learn", state, href: null });
const apply = (state: string) => ({ label: "Apply", state, href: null });
const show = (state: string) => ({
  label: "Show and tell",
  state,
  href: "/me/show-and-tell",
});
const DONE_TAG = { label: "Done", kind: "green" };
const NOW_TAG = { label: "Now", kind: "blue" };

test("11 at the week 2 target reads as the wireframe", async () => {
  const { t, as } = await calderLane();
  await move(t, "week2");
  expect(await as("dan").query(api.me.home, {})).toEqual({
    greeting: "Good afternoon, Dan",
    intro: "Week 2 of 4. Your protected hour starts today at 2:00 PM.",
    protectedTag: TAG,
    learn: { course: COURSE, session: 2, percent: 60 },
    reflect: NOT_STARTED,
    weeks: [
      done(1),
      current(2),
      todo(3, "23 Sep", "23 Sep"),
      todo(4, "Show and tell", "30 Sep"),
    ],
    agreement: AGREEMENT,
    agreementUpdated: false,
    afterCheckIn: false,
    beforeCheckIn: false,
  });
});

test("11 in week 1, before Dan's first session", async () => {
  const { t, as } = await calderLane();
  await move(t, "week1");
  expect(await as("dan").query(api.me.home, {})).toEqual({
    greeting: "Good afternoon, Dan",
    intro: "Week 1 of 4. Your protected hour starts today at 2:00 PM.",
    protectedTag: TAG,
    learn: { course: COURSE, session: 1, percent: 0 },
    reflect: NOT_STARTED,
    weeks: [
      current(1),
      todo(2, "16 Sep", "16 Sep"),
      todo(3, "23 Sep", "23 Sep"),
      todo(4, "Show and tell", "30 Sep"),
    ],
    agreement: AGREEMENT,
    agreementUpdated: false,
    afterCheckIn: false,
    beforeCheckIn: false,
  });
});

test("the intro follows the hour through week 2", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  await move(t, "week1");
  const intro = async (local: string) => {
    await clockAt(t, orgId, local);
    return (await dan.query(api.me.home, {}))?.intro;
  };
  expect(await intro("2026-09-14T10:00")).toBe(
    "Week 2 of 4. Your protected hour is Wednesday at 2:00 PM.",
  );
  expect(await intro("2026-09-16T13:00")).toBe(
    "Week 2 of 4. Your protected hour starts today at 2:00 PM.",
  );
  expect(await intro("2026-09-16T14:30")).toBe(
    "Week 2 of 4. Your protected hour is on now, until 3:00 PM.",
  );
  expect(await intro("2026-09-16T15:00")).toBe(
    "Week 2 of 4. Your next protected hour is Wednesday 23 September at 2:00 PM.",
  );
});

test("the greeting turns to evening at 5:00 PM (Ruling 23)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  await clockAt(t, orgId, "2026-09-16T16:59");
  expect((await as("dan").query(api.me.home, {}))?.greeting).toBe(
    "Good afternoon, Dan",
  );
  await clockAt(t, orgId, "2026-09-16T17:00");
  expect((await as("dan").query(api.me.home, {}))?.greeting).toBe(
    "Good evening, Dan",
  );
});

test("11 in week 4 asks the after check-in until it is answered", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  await move(t, "week3");
  expect((await dan.query(api.me.home, {}))?.afterCheckIn).toBe(false);
  await move(t, "week4");
  expect(await dan.query(api.me.home, {})).toMatchObject({
    intro: "Week 4 of 4. Your protected hour starts today at 2:00 PM.",
    learn: { course: COURSE, session: 4, percent: 100 },
    reflect: NOT_STARTED,
    weeks: [done(1), done(2), done(3), current(4)],
    afterCheckIn: true,
  });
  await dan.mutation(api.surveys.checkIn, {
    phase: "after",
    answers: { aiConfidence: 4, comfortWithManager: 4 },
    expectOrgId: orgId,
  });
  expect((await dan.query(api.me.home, {}))?.afterCheckIn).toBe(false);
});

test("11 once the sprint is complete", async () => {
  const { t, as } = await calderLane();
  await move(t, "complete");
  expect(await as("dan").query(api.me.home, {})).toMatchObject({
    greeting: "Good afternoon, Dan",
    intro: "Your sprint finished on Wednesday 30 September.",
    learn: { course: COURSE, session: 4, percent: 100 },
    reflect: ADDED,
    weeks: [done(1), done(2), done(3), done(4)],
    afterCheckIn: false,
    beforeCheckIn: false,
  });
});

test("a new agreement version asks Dan to review and sign", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  await move(t, "week2");
  expect((await dan.query(api.me.home, {}))?.agreementUpdated).toBe(false);
  await t.run(async (ctx) => {
    const v1 = (await ctx.db
      .query("agreements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first())!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, _creationTime, ...fields } = v1;
    await ctx.db.insert("agreements", {
      ...fields,
      version: 2,
      savedAt: mel("2026-09-15T09:00"),
    });
  });
  expect((await dan.query(api.me.home, {}))?.agreementUpdated).toBe(true);
});

test("an agreement with no tools and nothing ruled out reads as none agreed", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  await t.run(async (ctx) => {
    const v1 = (await ctx.db
      .query("agreements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first())!;
    await ctx.db.patch(v1._id, {
      tools: [],
      neverIn: v1.neverIn.map((item) => ({ ...item, on: false })),
    });
  });
  expect((await as("dan").query(api.me.home, {}))?.agreement).toEqual({
    ...AGREEMENT,
    tools: "None agreed yet.",
    neverIn: "None agreed yet.",
  });
});

test("another time zone gets its own greeting and the sprint's zone on the hour", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  await move(t, "week2");
  const danId = await personOf(t, orgId, "dan");
  await t.run((ctx) => ctx.db.patch(danId, { timeZone: "Europe/London" }));
  // 1:00 PM in Melbourne is 4:00 AM in London.
  expect(await dan.query(api.me.home, {})).toMatchObject({
    greeting: "Good morning, Dan",
    intro:
      "Week 2 of 4. Your protected hour starts today at 2:00 PM, Melbourne time.",
    protectedTag: "Protected time, Wed 2:00 to 3:00 PM, Melbourne time",
  });
  expect((await dan.query(api.me.sprint, {}))?.next).toEqual({
    day: "Wednesday, 2:00 PM, Melbourne time",
    detail: "16 September, 1 hour, protected from meetings",
  });
});

test("13 at the week 2 target counts two of eight", async () => {
  const { t, as } = await calderLane();
  await move(t, "week2");
  expect(await as("dan").query(api.me.sprint, {})).toEqual({
    intro: "9 to 30 September 2026. Two of eight activities done.",
    done: 2,
    of: 8,
    count: "2 of 8",
    weeks: [
      {
        name: "Week 1",
        date: "9 September",
        tag: DONE_TAG,
        current: false,
        activities: [learn("done"), apply("done")],
      },
      {
        name: "Week 2",
        date: "16 September",
        tag: NOW_TAG,
        current: true,
        activities: [
          learn("todo"),
          {
            label: "Apply, in progress",
            state: "progress",
            href: "/me/project",
          },
        ],
      },
      {
        name: "Week 3",
        date: "23 September",
        tag: null,
        current: false,
        activities: [learn("todo"), apply("todo")],
      },
      {
        name: "Week 4",
        date: "30 September",
        tag: null,
        current: false,
        activities: [learn("todo"), show("todo")],
      },
    ],
    next: {
      day: "Wednesday, 2:00 PM",
      detail: "16 September, 1 hour, protected from meetings",
    },
    calendar: {
      title: "Protected learning hour",
      startDate: expect.any(String),
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
    },
  });
});

test("13's next session moves to the 23rd at 3:00 PM (Review Focus 6)", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  await move(t, "week2");
  await clockAt(t, orgId, "2026-09-16T14:59");
  expect((await dan.query(api.me.sprint, {}))?.next?.detail).toBe(
    "16 September, 1 hour, protected from meetings",
  );
  await clockAt(t, orgId, "2026-09-16T15:00");
  expect((await dan.query(api.me.sprint, {}))?.next).toEqual({
    day: "Wednesday, 2:00 PM",
    detail: "23 September, 1 hour, protected from meetings",
  });
});

test("13 in week 1, week 4 and once complete", async () => {
  const { t, as } = await calderLane();
  const dan = as("dan");
  await move(t, "week1");
  const week1 = (await dan.query(api.me.sprint, {}))!;
  expect(week1.intro).toBe(
    "9 to 30 September 2026. Zero of eight activities done.",
  );
  // No project yet: the current week's Apply still leads to 12.
  expect(week1.weeks[0]!.activities[1]).toEqual({
    label: "Apply",
    state: "todo",
    href: "/me/project",
  });

  await move(t, "week4");
  expect(await dan.query(api.me.sprint, {})).toMatchObject({
    intro: "9 to 30 September 2026. Six of eight activities done.",
    done: 6,
    weeks: [
      { tag: DONE_TAG },
      { tag: DONE_TAG },
      { tag: DONE_TAG },
      { tag: NOW_TAG, activities: [learn("todo"), show("todo")] },
    ],
    next: { detail: "30 September, 1 hour, protected from meetings" },
  });

  await move(t, "complete");
  expect(await dan.query(api.me.sprint, {})).toMatchObject({
    intro: "9 to 30 September 2026. Eight of eight activities done.",
    done: 8,
    next: null,
  });
});

test("the hour stays 2:00 PM after Melbourne's clocks go forward (week 2 on 7 October)", async () => {
  // After 3 October, so not `mel`: AEDT is +11:00.
  vi.setSystemTime(Date.parse("2026-10-07T13:00:00+11:00"));
  const t = harness();
  const { orgId } = await workspace(t);
  await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.insert("sprints", {
      orgId,
      teamId: team._id,
      startDate: "2026-09-30",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: COURSE,
      launchedAt: mel("2026-09-29T10:00"),
      createdAt: mel("2026-09-22T09:30"),
    });
  });
  const { as } = await seat(t, orgId, "user_dan", []);
  expect((await as.query(api.me.home, {}))?.intro).toBe(
    "Week 2 of 4. Your protected hour starts today at 2:00 PM.",
  );
});

test("the greeting turns to afternoon at 12:00 PM", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  await clockAt(t, orgId, "2026-09-16T11:59");
  expect((await as("dan").query(api.me.home, {}))?.greeting).toBe(
    "Good morning, Dan",
  );
  await clockAt(t, orgId, "2026-09-16T12:00");
  expect((await as("dan").query(api.me.home, {}))?.greeting).toBe(
    "Good afternoon, Dan",
  );
});

test("13 in week 3: a project started in week 2 leaves week 1's Apply undone", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week3");
  const danId = await personOf(t, orgId, "dan");
  await t.run(async (ctx) => {
    const project = (await ctx.db
      .query("projects")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", danId))
      .first())!;
    await ctx.db.patch(project._id, { startedWeek: 2 });
  });
  const weeks = (await as("dan").query(api.me.sprint, {}))!.weeks;
  expect(weeks[0]!.activities[1]).toMatchObject({
    label: "Apply",
    state: "todo",
  });
  expect(weeks[1]!.activities[1]).toMatchObject({
    label: "Apply",
    state: "done",
  });
});

test("before launch there is no week to show", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as } = await seat(t, orgId, "user_e", []);
  expect(await as.query(api.me.home, {})).toBeNull();
  expect(await as.query(api.me.sprint, {})).toBeNull();
});
