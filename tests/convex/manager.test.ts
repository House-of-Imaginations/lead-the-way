import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEMO_CAST, castOf, type CastKey } from "../../convex/lib/demo/cast";
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
      launchedAt: mel("2026-09-08T10:00"),
      createdAt: mel("2026-09-01T09:30"),
    });
  });
}

const PENDING = {
  kind: "pending",
  helper: "Updated after Wed 9 Sep, 3:00 PM",
} as const;
const SAVED_BODY =
  "Last updated 7 September 2026. You'll review it together at the week 4 show and tell.";
const shown = (value: number, of: number) =>
  ({ kind: "shown", value, of }) as const;

test("overview has no per-person fields", async () => {
  const { t, as } = await calderLane();
  await move(t, "complete");
  const overview = await as("priya").query(api.manager.overview, {});
  expect(overview?.team).not.toBeNull();

  const keys = new Set<string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === "object" && value !== null) {
      for (const [key, inner] of Object.entries(value)) {
        keys.add(key);
        walk(inner);
      }
    }
  };
  walk(overview);
  // `learning.percent` is the viewer's own coaching path, not a teammate's.
  for (const key of ["personId", "name", "email", "userId", "_id", "people"]) {
    expect(keys.has(key), key).toBe(false);
  }
  const text = JSON.stringify(overview);
  for (const person of DEMO_CAST) {
    expect(text).not.toContain(person.name);
    expect(text).not.toContain(person.name.split(" ")[0]!);
    expect(text).not.toContain(person.email);
  }
});

test("an opt-out leaves invited and joined alone and waits for the next snapshot", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await move(t, "week2");
  const before = await priya.query(api.manager.overview, {});
  await optOut(t, orgId, await personOf(t, orgId, "dan"));
  // Nothing on 08 moves until the next snapshot (Review Focus 1).
  expect(await priya.query(api.manager.overview, {})).toEqual(before);

  await move(t, "week3");
  const after = (await priya.query(api.manager.overview, {}))!;
  // Dan is still invited and joined (Ruling 3, spec rule 5).
  expect(after.sprint).toMatchObject({
    invited: 8,
    joined: 7,
    projects: shown(4, 6),
  });
  expect(after.team).toEqual({
    sessionDone: { label: "Week 2 session done", stat: shown(6, 6) },
    tasksUnderway: { label: "Real tasks underway", stat: shown(4, 6) },
  });
});

test("a team below the threshold sees hidden totals", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  for (const subject of ["user_a", "user_b", "user_c", "user_d"]) {
    await seat(t, orgId, subject, []);
  }
  await launchedSprint(t, orgId);
  await t.mutation(internal.snapshots.take, { orgId });
  const hidden = { kind: "hidden", helper: "Hidden until 5 responses" };
  expect(await owner.query(api.manager.overview, {})).toMatchObject({
    phase: "active",
    sprint: { title: "Week 1 of 4", projects: hidden },
    team: {
      sessionDone: { label: "Week 1 session done", stat: hidden },
      tasksUnderway: { label: "Real tasks underway", stat: hidden },
    },
  });
});

test("the week we're in stays current after its hour, until Monday", async () => {
  vi.setSystemTime(mel("2026-09-09T16:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await launchedSprint(t, orgId);
  const overview = (await owner.query(api.manager.overview, {}))!;
  expect(overview.intro).toBe(
    "Your team is in week 1. The next protected hour is Wednesday 16 September at 2:00 PM.",
  );
  expect(overview.timeline[1]).toMatchObject({
    label: "Week 1, 9 Sep (current)",
    state: "current",
    items: [{ label: "Learn and apply", done: false }],
  });
});

test("a custom role with team:insights sees aggregates only", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
  const theirs = (await lead.query(api.manager.overview, {}))!;
  const priyas = (await as("priya").query(api.manager.overview, {}))!;
  expect(theirs.team).not.toBeNull();
  // The same team totals as the owner's; only their own learning differs.
  expect({ ...theirs, learning: null }).toEqual({ ...priyas, learning: null });
  expect(theirs.learning.percent).toBe(0);
});

test("sprint:manage without team:insights gets team: null", async () => {
  const { t, orgId } = await calderLane();
  await move(t, "week2");
  const { as: planner } = await seat(t, orgId, "user_planner", [
    "sprint:manage",
  ]);
  // No throw: /manager is this role's home (Review Focus 4).
  const overview = (await planner.query(api.manager.overview, {}))!;
  expect(overview.team).toBeNull();
  expect(overview.sprint).toMatchObject({
    title: "Week 2 of 4",
    invited: 8,
    joined: 7,
    projects: null,
  });
});

test("an employee can't read the overview", async () => {
  const { t, as } = await calderLane();
  await move(t, "week1");
  await expect(
    as("dan").query(api.manager.overview, {}),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});

test("no sprint yet reads as null", async () => {
  const t = harness();
  const { owner } = await workspace(t);
  expect(await owner.query(api.manager.overview, {})).toBeNull();
});

test("the overview's words at each demo target", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");

  // Setup, after the tester saves the team.
  await priya.mutation(api.teams.saveProfile, {
    challenges: [],
    finish: true,
    expectOrgId: orgId,
  });
  const todo = (label: string, item = "Learn and apply") => ({
    label,
    state: "todo",
    items: [{ label: item, done: false }],
  });
  expect(await priya.query(api.manager.overview, {})).toEqual({
    phase: "draft",
    intro: "Your sprint starts Wednesday 9 September at 2:00 PM.",
    timeline: [
      {
        label: "Setup, 1 to 8 Sep",
        state: "current",
        items: [
          { label: "Manager pathway", done: false },
          { label: "Team AI Agreement", done: false },
          { label: "Invite team", done: false },
        ],
      },
      todo("Week 1, 9 Sep"),
      todo("Week 2, 16 Sep"),
      todo("Week 3, 23 Sep"),
      todo("Week 4, 30 Sep", "Show and tell"),
    ],
    learning: {
      title: "Leading AI at Work",
      label: "Sprint coaching modules",
      percent: 0,
    },
    sprint: {
      title: "Starts 9 Sep",
      tag: { label: "Draft", kind: "gray" },
      invited: 0,
      joined: 0,
      projects: PENDING,
    },
    agreement: {
      title: "Not saved yet",
      tag: { label: "Draft", kind: "gray" },
      body: null,
    },
    team: null,
  });

  const states = async () =>
    (await priya.query(api.manager.overview, {}))!.timeline.map((c) => [
      c.label,
      c.state,
    ]);

  // Week 1: launched, before the first hour. Dan signs at 1:45 PM.
  await move(t, "week1");
  const week1 = (await priya.query(api.manager.overview, {}))!;
  expect(week1).toMatchObject({
    phase: "active",
    intro:
      "Your team is in week 1. The next protected hour is Wednesday 9 September at 2:00 PM.",
    sprint: {
      title: "Week 1 of 4",
      tag: { label: "Active", kind: "blue" },
      invited: 8,
      joined: 7,
      projects: PENDING,
    },
    agreement: {
      title: "Saved",
      tag: { label: "Saved", kind: "green" },
      body: SAVED_BODY,
    },
    team: {
      sessionDone: { label: "Week 1 session done", stat: PENDING },
      tasksUnderway: { label: "Real tasks underway", stat: PENDING },
    },
  });
  expect(week1.timeline[0]!.items.every((item) => item.done)).toBe(true);
  expect(await states()).toEqual([
    ["Setup, 1 to 8 Sep", "done"],
    ["Week 1, 9 Sep (current)", "current"],
    ["Week 2, 16 Sep", "todo"],
    ["Week 3, 23 Sep", "todo"],
    ["Week 4, 30 Sep", "todo"],
  ]);

  // Week 2: the week 1 snapshot is in, and everyone has signed.
  await move(t, "week2");
  expect(await priya.query(api.manager.overview, {})).toMatchObject({
    intro:
      "Your team is in week 2. The next protected hour is Wednesday 16 September at 2:00 PM.",
    learning: { percent: 65 },
    sprint: {
      title: "Week 2 of 4",
      tag: { label: "Active", kind: "blue" },
      projects: shown(5, 7),
    },
    agreement: {
      title: "Signed by the team",
      tag: { label: "Completed", kind: "green" },
      body: SAVED_BODY,
    },
    team: {
      sessionDone: { label: "Week 1 session done", stat: shown(6, 7) },
      tasksUnderway: { label: "Real tasks underway", stat: shown(5, 7) },
    },
  });
  expect(await states()).toEqual([
    ["Setup, 1 to 8 Sep", "done"],
    ["Week 1, 9 Sep", "done"],
    ["Week 2, 16 Sep (current)", "current"],
    ["Week 3, 23 Sep", "todo"],
    ["Week 4, 30 Sep", "todo"],
  ]);

  // Complete: the week 4 snapshot. Grace has no project.
  await move(t, "complete");
  expect(await priya.query(api.manager.overview, {})).toMatchObject({
    phase: "complete",
    intro: "Your sprint finished on Wednesday 30 September.",
    sprint: {
      title: "Sprint complete",
      tag: { label: "Completed", kind: "green" },
      invited: 8,
      joined: 7,
      projects: shown(6, 7),
    },
    team: {
      sessionDone: { label: "Week 4 session done", stat: shown(7, 7) },
      tasksUnderway: { label: "Real tasks underway", stat: shown(6, 7) },
    },
  });
  expect(await states()).toEqual([
    ["Setup, 1 to 8 Sep", "done"],
    ["Week 1, 9 Sep", "done"],
    ["Week 2, 16 Sep", "done"],
    ["Week 3, 23 Sep", "done"],
    ["Week 4, 30 Sep", "done"],
  ]);
});
