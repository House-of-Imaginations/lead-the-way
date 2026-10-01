import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf, type CastKey } from "../../convex/lib/demo/cast";
import {
  DEMO_TARGETS,
  mel,
  type DemoTarget,
} from "../../convex/lib/demo/schedule";
import { PATHWAY_MODULES } from "../../convex/lib/pathway";
import {
  calderLane,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
  // A real workspace's launch must not mail anyone (see launch.test.ts).
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const move = (t: T, target: DemoTarget) =>
  t.mutation(internal.seed.clock, { target });

/** A workspace's snapshots in week order, without ids. */
async function snapshotsOf(t: T, orgId: Id<"orgs">) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("teamSnapshots")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  return rows
    .sort((a, b) => a.week - b.week)
    .map(({ week, takenAt, sessionDone, tasksUnderway }) => ({
      week,
      takenAt,
      sessionDone,
      tasksUnderway,
    }));
}

async function personOf(t: T, orgId: Id<"orgs">, key: CastKey) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

/** "Include me in team totals" switched off. */
async function optOut(t: T, orgId: Id<"orgs">, personId: Id<"people">) {
  await t.run((ctx) =>
    ctx.db.insert("settings", {
      orgId,
      personId,
      weeklyReminder: true,
      showAndTellReminder: true,
      askBeforeSharing: true,
      reflectionsOnCredential: false,
      includeInTeamTotals: false,
      captionsByDefault: false,
      reduceMotion: false,
    }),
  );
}

/** Launched on 8 September, week one on Wednesday the 9th. */
async function launchedSprint(t: T, orgId: Id<"orgs">) {
  return await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    return await ctx.db.insert("sprints", {
      orgId,
      teamId: team._id,
      startDate: "2026-09-09",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: "AI Productivity Fundamentals",
      launchedAt: mel("2026-09-08T10:00"),
      createdAt: mel("2026-09-01T09:30"),
    });
  });
}

/** What `launch` needs besides the hour: everyone's pathway and a saved agreement. */
async function readyToLaunch(t: T, orgId: Id<"orgs">) {
  await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const person of people) {
      for (const m of PATHWAY_MODULES) {
        if (m.pathway !== "required") continue;
        await ctx.db.insert("pathwayProgress", {
          orgId,
          personId: person._id,
          moduleKey: m.key,
          minutesWatched: m.minutes,
          completedAt: 1,
        });
      }
    }
    await ctx.db.insert("agreements", {
      orgId,
      teamId: team._id,
      version: 1,
      status: "saved",
      tools: [],
      neverIn: [],
      checks: [],
      escalation: "",
      contact: { kind: "label", label: "Privacy officer" },
      savedAt: 1,
    });
  });
}

/** The snapshot runs a launch scheduled, as instants and arguments. */
async function scheduled(t: T) {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs
    .filter((job) => job.name === "snapshots:take")
    .map((job) => ({
      at: new Date(job.scheduledTime).toISOString(),
      args: job.args,
    }));
}

test("the week 2 jump freezes week 1's totals", async () => {
  const { t, orgId } = await calderLane();
  await move(t, "week1");
  // Week one's hour hasn't ended yet.
  expect(await snapshotsOf(t, orgId)).toEqual([]);
  await move(t, "week2");
  // Six of the seven joined went to week 1's session (not Grace); five
  // started a project (not Luca or Grace).
  expect(await snapshotsOf(t, orgId)).toEqual([
    {
      week: 1,
      takenAt: DEMO_TARGETS.week2,
      sessionDone: { hidden: false, n: 7, value: 6 },
      tasksUnderway: { hidden: false, n: 7, value: 5 },
    },
  ]);
});

test("moveClock takes each due snapshot once", async () => {
  const { t, orgId } = await calderLane();
  // Straight from setup to week 3 (Review Focus 2): weeks 1 and 2 have ended.
  await move(t, "week3");
  const first = await snapshotsOf(t, orgId);
  expect(first.map((row) => [row.week, row.takenAt])).toEqual([
    [1, DEMO_TARGETS.week3],
    [2, DEMO_TARGETS.week3],
  ]);

  await move(t, "week4");
  // The same target again adds nothing.
  await move(t, "week4");
  const second = await snapshotsOf(t, orgId);
  expect(second.slice(0, 2)).toEqual(first);
  expect(second.map((row) => [row.week, row.takenAt])).toEqual([
    [1, DEMO_TARGETS.week3],
    [2, DEMO_TARGETS.week3],
    [3, DEMO_TARGETS.week4],
  ]);

  await move(t, "complete");
  expect((await snapshotsOf(t, orgId)).map((row) => row.week)).toEqual([
    1, 2, 3, 4,
  ]);
});

test("a straight jump freezes the same totals as stepping through every target", async () => {
  const totals = async ({ t, orgId }: { t: T; orgId: Id<"orgs"> }) =>
    (await snapshotsOf(t, orgId)).map(
      ({ week, sessionDone, tasksUnderway }) => ({
        week,
        sessionDone,
        tasksUnderway,
      }),
    );
  const direct = await calderLane();
  await move(direct.t, "complete");
  const staged = await calderLane();
  for (const target of Object.keys(DEMO_TARGETS) as DemoTarget[]) {
    await move(staged.t, target);
  }
  const stepped = await totals(staged);
  expect(stepped.map((row) => row.week)).toEqual([1, 2, 3, 4]);
  // Each week as of its own hour's end, not as of the jump.
  expect(stepped[0].sessionDone).toMatchObject({ n: 7, value: 6 });
  expect(await totals(direct)).toEqual(stepped);
});

test("an opt-out after the snapshot leaves it unchanged", async () => {
  const { t, orgId } = await calderLane();
  await move(t, "week2");
  const [week1] = await snapshotsOf(t, orgId);
  // Dan opts out during week 2 (Review Focus 1).
  await optOut(t, orgId, await personOf(t, orgId, "dan"));
  await move(t, "week3");
  const rows = await snapshotsOf(t, orgId);
  // Week 1 still reads "6 of 7".
  expect(rows[0]).toEqual(week1);
  // The change shows only in week 2, mixed with everyone else's.
  expect(rows[1]).toEqual({
    week: 2,
    takenAt: DEMO_TARGETS.week3,
    sessionDone: { hidden: false, n: 6, value: 6 },
    tasksUnderway: { hidden: false, n: 6, value: 4 },
  });
});

test("a team below the threshold stores hidden totals, from the end of the hour", async () => {
  vi.setSystemTime(mel("2026-09-09T14:59"));
  const t = harness();
  const { orgId } = await workspace(t);
  // Four employees; the owner reads team totals, so never counts.
  for (const subject of ["user_a", "user_b", "user_c", "user_d"]) {
    await seat(t, orgId, subject, []);
  }
  const sprintId = await launchedSprint(t, orgId);

  await t.mutation(internal.snapshots.take, { orgId, sprintId });
  expect(await snapshotsOf(t, orgId)).toEqual([]);

  vi.setSystemTime(mel("2026-09-09T15:00"));
  await t.mutation(internal.snapshots.take, { orgId, sprintId });
  await t.mutation(internal.snapshots.take, { orgId, sprintId });
  expect(await snapshotsOf(t, orgId)).toEqual([
    {
      week: 1,
      takenAt: mel("2026-09-09T15:00"),
      sessionDone: { hidden: true, n: 4 },
      tasksUnderway: { hidden: true, n: 4 },
    },
  ]);
});

test("a real launch schedules one snapshot per week, at each hour's end, and a backstop", async () => {
  // Sunday 20 September: week one is Wednesday the 23rd, and the sprint
  // crosses daylight saving on 4 October (Review Focus 5). Timers stay fake,
  // so no scheduled run fires during the test.
  vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
  vi.setSystemTime(mel("2026-09-20T23:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await owner.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  await readyToLaunch(t, orgId);
  await owner.mutation(api.sprints.launch, {
    emails: ["ana@example.com"],
    message: "",
    expectOrgId: orgId,
  });
  const { sprintId } = (await owner.query(api.sprints.current, {}))!;
  const args = [{ orgId, sprintId }];
  expect(await scheduled(t)).toEqual([
    // 3:00 PM AEST, UTC+10.
    { at: "2026-09-23T05:00:00.000Z", args },
    { at: "2026-09-30T05:00:00.000Z", args },
    // 3:00 PM AEDT, UTC+11.
    { at: "2026-10-07T04:00:00.000Z", args },
    { at: "2026-10-14T04:00:00.000Z", args },
    // A day later, backing up the last week.
    { at: "2026-10-15T04:00:00.000Z", args },
  ]);
});

test("a run for a sprint that has gone does nothing, even with a new one launched", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  const t = harness();
  const { orgId } = await workspace(t);
  for (const subject of ["a", "b", "c", "d", "e"]) {
    await seat(t, orgId, `user_${subject}`, []);
  }
  const gone = await launchedSprint(t, orgId);
  await t.run((ctx) => ctx.db.delete(gone));
  // The team's next sprint (P7), its week 1 hour also over.
  await launchedSprint(t, orgId);
  await t.mutation(internal.snapshots.take, { orgId, sprintId: gone });
  expect(await snapshotsOf(t, orgId)).toEqual([]);
});

test("a run never takes another workspace's sprint", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  const t = harness();
  const { orgId } = await workspace(t);
  const other = await workspace(t, "Birch Row");
  for (const subject of ["a", "b", "c", "d", "e"]) {
    await seat(t, other.orgId, `user_${subject}`, []);
  }
  const theirs = await launchedSprint(t, other.orgId);
  await t.mutation(internal.snapshots.take, { orgId, sprintId: theirs });
  expect(await snapshotsOf(t, orgId)).toEqual([]);
  expect(await snapshotsOf(t, other.orgId)).toEqual([]);
});

test("a demo launch schedules nothing: the demo clock takes them", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  await readyToLaunch(t, orgId);
  await priya.mutation(api.sprints.launch, {
    emails: [castOf("dan").email],
    message: "",
    expectOrgId: orgId,
  });
  expect(await scheduled(t)).toEqual([]);
});

test("the demo launched with DEMO_MODE off runs on real time, so it schedules", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
  vi.setSystemTime(mel("2026-09-01T09:30"));
  const { t, orgId, as } = await calderLane();
  vi.stubEnv("DEMO_MODE", "off");
  const priya = as("priya");
  await priya.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  await readyToLaunch(t, orgId);
  await priya.mutation(api.sprints.launch, {
    emails: [castOf("dan").email],
    message: "",
    expectOrgId: orgId,
  });
  expect(await scheduled(t)).toHaveLength(5);
});
