import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEMO_CAST, castOf, type CastKey } from "../../convex/lib/demo/cast";
import { mel, type DemoTarget } from "../../convex/lib/demo/schedule";
import { snapshotSeries } from "../../convex/lib/snapshots";
import { setupSprint } from "../../convex/lib/sprint";
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

const PENDING = {
  kind: "pending",
  helper: "Updated after Wed 9 Sep, 3:00 PM",
} as const;
const SAVED_BODY =
  "Last updated 7 September 2026. You'll review it together at the week 4 show and tell.";
const shown = (value: number, of: number) =>
  ({ kind: "shown", value, of }) as const;
/** Ruling 6: hidden after a change to who is counted, naming nobody. */
const CHANGED = {
  kind: "hidden",
  helper: "Hidden after a change to who is counted",
} as const;

test("overview has no per-person fields", async () => {
  const { t, orgId, as } = await calderLane();
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
  for (const key of [
    "personId",
    "name",
    "email",
    "userId",
    "_id",
    "people",
    "counted",
    "seated",
  ]) {
    expect(keys.has(key), key).toBe(false);
  }
  const text = JSON.stringify(overview);
  for (const person of DEMO_CAST) {
    expect(text).not.toContain(person.name);
    expect(text).not.toContain(person.name.split(" ")[0]!);
    expect(text).not.toContain(person.email);
  }
  // Nor any person's id, which a snapshot's `counted` holds (Ruling 6).
  const ids = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).map((p) => p._id),
  );
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(text).not.toContain(id);
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
    projects: CHANGED,
  });
  // Week 2 counts one person fewer than week 1, so it can't be shown beside
  // it (Ruling FX).
  expect(after.team).toEqual({
    sessionDone: { label: "Week 2 session done", stat: CHANGED },
    tasksUnderway: { label: "Real tasks underway", stat: CHANGED },
  });
});

test("a team below the threshold sees hidden totals", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  for (const subject of ["user_a", "user_b", "user_c", "user_d"]) {
    await seat(t, orgId, subject, []);
  }
  const sprintId = await launchedSprint(t, orgId);
  await t.mutation(internal.snapshots.take, { orgId, sprintId });
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

test("a snapshot taken under a lower threshold hides once it is raised", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  for (const subject of ["a", "b", "c", "d", "e", "f"]) {
    await seat(t, orgId, `user_${subject}`, []);
  }
  const sprintId = await launchedSprint(t, orgId);
  await t.mutation(internal.snapshots.take, { orgId, sprintId });
  const shownAt5 = (await owner.query(api.manager.overview, {}))!;
  expect(shownAt5.team?.sessionDone.stat).toEqual(shown(0, 6));

  await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 10 }));
  const hidden = { kind: "hidden", helper: "Hidden until 10 responses" };
  expect(await owner.query(api.manager.overview, {})).toMatchObject({
    sprint: { projects: hidden },
    team: { sessionDone: { stat: hidden }, tasksUnderway: { stat: hidden } },
  });
});

test("an opt-out never flips the agreement to signed by the team", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await move(t, "week2");
  const title = async () =>
    (await priya.query(api.manager.overview, {}))!.agreement.title;
  expect(await title()).toBe("Signed by the team");

  // Everyone but Dan has signed.
  const dan = await personOf(t, orgId, "dan");
  await t.run(async (ctx) => {
    for (const s of await ctx.db.query("agreementSignatures").collect()) {
      if (s.personId === dan) await ctx.db.delete(s._id);
    }
  });
  expect(await title()).toBe("Saved");
  // Dan opts out of team totals: the title must not give that away.
  await optOut(t, orgId, dan);
  expect(await title()).toBe("Saved");
});

test("a lead isn't on the team, so the title never waits for their signature (Ruling 1)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
  // The title doesn't depend on which team:insights holder is looking.
  for (const viewer of [lead, as("priya")]) {
    expect(
      (await viewer.query(api.manager.overview, {}))!.agreement,
    ).toMatchObject({
      title: "Signed by the team",
      tag: { label: "Completed", kind: "green" },
    });
  }
});

test("without team:insights the agreement reads Saved, even when everyone has signed (F1)", async () => {
  const { t, orgId } = await calderLane();
  await move(t, "week2");
  // Everyone seated has signed: Priya sees "Signed by the team" above.
  for (const permission of ["members:manage", "sprint:manage"] as const) {
    const { as } = await seat(
      t,
      orgId,
      `user_${permission.replace(":", "_")}`,
      [permission],
    );
    expect(
      (await as.query(api.manager.overview, {}))!.agreement,
      permission,
    ).toMatchObject({
      title: "Saved",
      tag: { label: "Saved", kind: "green" },
    });
  }
});

test("a real sprint launched before week one's Monday reads as scheduled", async () => {
  // Sunday 6 September, the day before week one's Monday.
  vi.setSystemTime(mel("2026-09-06T09:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const sprintId = await launchedSprint(t, orgId);
  await t.run((ctx) =>
    ctx.db.patch(sprintId, { launchedAt: mel("2026-09-05T10:00") }),
  );
  const overview = (await owner.query(api.manager.overview, {}))!;
  expect(overview).toMatchObject({
    phase: "scheduled",
    intro: "Your sprint starts Wednesday 9 September at 2:00 PM.",
    sprint: {
      title: "Starts 9 Sep",
      tag: { label: "Scheduled", kind: "gray" },
      projects: PENDING,
    },
    team: {
      sessionDone: { label: "Week 1 session done", stat: PENDING },
      tasksUnderway: { label: "Real tasks underway", stat: PENDING },
    },
  });
  expect(overview.timeline.map((c) => [c.label, c.state])).toEqual([
    ["Setup, 1 to 8 Sep", "done"],
    ["Week 1, 9 Sep", "todo"],
    ["Week 2, 16 Sep", "todo"],
    ["Week 3, 23 Sep", "todo"],
    ["Week 4, 30 Sep", "todo"],
  ]);
});

test("a declined invitation leaves invited (R-c)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  await t.run(async (ctx) => {
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
      .collect();
    const open = invites.find((i) => i.status !== "accepted")!;
    await ctx.db.patch(open._id, { status: "declined" });
  });
  // Invited is the seated team and the open invitations, as in every sprint.
  expect(
    (await as("priya").query(api.manager.overview, {}))!.sprint,
  ).toMatchObject({ invited: 7, joined: 7 });
});

test("an employee moved to a members:manage role leaves sprint 1's counts (F3, R-c)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const dan = await personOf(t, orgId, "dan");
  const { roleId } = await seat(t, orgId, "user_people", ["members:manage"]);
  await t.run((ctx) => ctx.db.patch(dan, { roleId }));
  // A manager now (W-f): not one of the team, so neither joined nor invited.
  expect(
    (await as("priya").query(api.manager.overview, {}))!.sprint,
  ).toMatchObject({ invited: 7, joined: 6 });
});

test("sprint 1 counts the seated team, however they came to be on it (R-c)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const priya = as("priya");
  const lead = await seat(t, orgId, "user_lead", ["team:insights"]);
  expect((await priya.query(api.manager.overview, {}))!.sprint).toMatchObject({
    invited: 8,
    joined: 7,
  });
  const employee = (await priya.query(api.orgRoles.list, {})).find(
    (r) => r.name === "Employee",
  )!._id;
  // A role change, not a launch invitation, puts them on the team.
  await priya.mutation(api.members.changeRole, {
    personId: lead.personId,
    roleId: employee,
    expectOrgId: orgId,
  });
  expect((await priya.query(api.manager.overview, {}))!.sprint).toMatchObject({
    invited: 9,
    joined: 8,
  });
});

test("an open invitation to somebody already seated isn't counted twice (R-c, R-i)", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const priya = as("priya");
  const before = (await priya.query(api.manager.overview, {}))!.sprint;
  expect(before).toMatchObject({ invited: 8, joined: 7 });
  // Dan accepted an older invitation; a newer one to his address stays pending.
  await t.run(async (ctx) => {
    const omar = (
      await ctx.db
        .query("orgInvites")
        .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
        .collect()
    ).find((i) => i.status === "pending")!;
    await ctx.db.insert("orgInvites", {
      orgId,
      roleId: omar.roleId,
      sprintId: omar.sprintId,
      token: "dan-again",
      email: castOf("dan").email,
      status: "pending",
      invitedBy: omar.invitedBy,
      expiresAt: omar.expiresAt,
      createdAt: omar.createdAt,
    });
  });
  expect((await priya.query(api.manager.overview, {}))!.sprint).toMatchObject({
    invited: 8,
    joined: 7,
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
  // The same team totals as the owner's; only their own learning and what
  // they may manage differ.
  expect({ ...theirs, learning: null, canManage: null }).toEqual({
    ...priyas,
    learning: null,
    canManage: null,
  });
  expect(theirs.learning.percent).toBe(0);
  // No sprint:manage, so 08 hides the links that would bounce them back.
  expect(theirs.canManage).toBe(false);
  expect(priyas.canManage).toBe(true);
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

test("workspace control alone reads the overview with no team totals (W-f)", async () => {
  const { t, orgId } = await calderLane();
  await move(t, "week2");
  for (const permission of [
    "org:manage",
    "members:manage",
    "roles:manage",
  ] as const) {
    const { as } = await seat(
      t,
      orgId,
      `user_${permission.replace(":", "_")}`,
      [permission],
    );
    const overview = (await as.query(api.manager.overview, {}))!;
    expect(overview.team, permission).toBeNull();
    expect(overview.canManage, permission).toBe(false);
  }
});

test("an employee can't read the overview", async () => {
  const { t, as } = await calderLane();
  await move(t, "week1");
  await expect(as("dan").query(api.manager.overview, {})).rejects.toMatchObject(
    { data: { code: "FORBIDDEN" } },
  );
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
    canManage: true,
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

test("a one-person cohort change hides the later rows, compared with the first row (Ruling FX)", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await move(t, "week2");
  // Week 1 counted all seven.
  expect(
    (await priya.query(api.manager.overview, {}))!.team?.sessionDone.stat,
  ).toEqual(shown(6, 7));

  // Dan opts out during week 2, so week 2 counts six (Review Focus 1).
  await optOut(t, orgId, await personOf(t, orgId, "dan"));
  await move(t, "week3");
  const week2 = (await priya.query(api.manager.overview, {}))!;
  expect(week2.sprint.projects).toEqual(CHANGED);
  expect(week2.team).toEqual({
    sessionDone: { label: "Week 2 session done", stat: CHANGED },
    tasksUnderway: { label: "Real tasks underway", stat: CHANGED },
  });

  // Week 3 counts the same six as week 2, but the first row is the one each
  // row must match, and week 1 counted seven, so week 3 stays hidden too.
  await move(t, "week4");
  const week3 = (await priya.query(api.manager.overview, {}))!;
  expect(week3.team).toEqual({
    sessionDone: { label: "Week 3 session done", stat: CHANGED },
    tasksUnderway: { label: "Real tasks underway", stat: CHANGED },
  });

  const reader = await personOf(t, orgId, "priya");
  const series = await t.run(async (ctx) => {
    const sprint = (await setupSprint(ctx, orgId))!;
    const { weeks, outcomes } = await snapshotSeries(ctx, sprint, reader);
    return {
      weeks: weeks.map(({ row, comparable }) => [
        row.week,
        row.counted?.length,
        comparable,
      ]),
      outcomes,
    };
  });
  expect(series).toEqual({
    weeks: [
      [1, 7, true],
      [2, 6, false],
      [3, 6, false],
    ],
    outcomes: null,
  });
});

test("a reader counted in a row sees it hidden", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  // Mei was counted in week 1. Now she is given a role that reads totals.
  const mei = await personOf(t, orgId, "mei");
  await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Team lead",
      permissions: ["team:insights"],
      createdAt: 0,
    });
    await ctx.db.patch(mei, { roleId });
  });
  const hers = (await as("mei").query(api.manager.overview, {}))!;
  expect(hers.sprint.projects).toEqual(CHANGED);
  expect(hers.team).toEqual({
    sessionDone: { label: "Week 1 session done", stat: CHANGED },
    tasksUnderway: { label: "Real tasks underway", stat: CHANGED },
  });
  // The same row reads as shown to Priya, whom it never counted.
  expect(
    (await as("priya").query(api.manager.overview, {}))!.team?.sessionDone.stat,
  ).toEqual(shown(6, 7));
});

/**
 * Calder Lane at week 3. Mei opts out (or not) before week 1's row is taken,
 * then is given a role that reads totals before week 2's. Checks the stored
 * rows really hold that story.
 */
async function meiPromotedInWeek2(optedOut: boolean) {
  const { t, orgId, as } = await calderLane();
  await move(t, "week1");
  const mei = await personOf(t, orgId, "mei");
  if (optedOut) await optOut(t, orgId, mei);
  await move(t, "week2");
  await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Team lead",
      permissions: ["team:insights"],
      createdAt: 0,
    });
    await ctx.db.patch(mei, { roleId });
  });
  await move(t, "week3");
  const [week1, week2] = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("teamSnapshots")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).sort((a, b) => a.week - b.week),
  );
  expect(week1?.seated).toContain(mei);
  expect(week2?.seated).not.toContain(mei);
  expect(week1?.counted?.includes(mei)).toBe(!optedOut);
  expect(week2?.counted).not.toContain(mei);
  return { as };
}

const WEEK2_CHANGED = {
  sessionDone: { label: "Week 2 session done", stat: CHANGED },
  tasksUnderway: { label: "Real tasks underway", stat: CHANGED },
};

test("a role change hides the totals whether or not that person opted out (Ruling FX, attack 2)", async () => {
  // Opted out, both rows count the same six; the roster still changed, so
  // showing or hiding never tells Priya which it was.
  for (const optedOut of [true, false]) {
    const { as } = await meiPromotedInWeek2(optedOut);
    const priya = (await as("priya").query(api.manager.overview, {}))!;
    expect(priya.team, `opted out: ${optedOut}`).toEqual(WEEK2_CHANGED);
  }
});

test("after a promotion, the new reader sees the row hidden as Priya does (Ruling FX, attack 3)", async () => {
  for (const optedOut of [true, false]) {
    const { as } = await meiPromotedInWeek2(optedOut);
    const mei = (await as("mei").query(api.manager.overview, {}))!;
    expect(mei.team, `opted out: ${optedOut}`).toEqual(WEEK2_CHANGED);
  }
});

test("a row with no stored cohort reads hidden", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  for (const subject of ["a", "b", "c", "d", "e", "f"]) {
    await seat(t, orgId, `user_${subject}`, []);
  }
  const sprintId = await launchedSprint(t, orgId);
  // Taken before P7a: totals, but no `counted` and no `threshold`.
  await t.run((ctx) =>
    ctx.db.insert("teamSnapshots", {
      orgId,
      sprintId,
      week: 1,
      takenAt: mel("2026-09-09T15:00"),
      sessionDone: { hidden: false, n: 6, value: 5 },
      tasksUnderway: { hidden: false, n: 6, value: 4 },
    }),
  );
  expect(await owner.query(api.manager.overview, {})).toMatchObject({
    sprint: { projects: CHANGED },
    team: {
      sessionDone: { label: "Week 1 session done", stat: CHANGED },
      tasksUnderway: { stat: CHANGED },
    },
  });
});

test("stored rows keep their threshold", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  /** Six employees, and week 1's row taken under `threshold`. */
  const teamOfSix = async (threshold: number) => {
    const t = harness();
    const { owner, orgId } = await workspace(t);
    await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: threshold }));
    for (const subject of ["a", "b", "c", "d", "e", "f"]) {
      await seat(t, orgId, `user_${subject}`, []);
    }
    const sprintId = await launchedSprint(t, orgId);
    await t.mutation(internal.snapshots.take, { orgId, sprintId });
    return {
      setThreshold: (privacyThreshold: number) =>
        t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold })),
      stat: async () =>
        (await owner.query(api.manager.overview, {}))!.team?.sessionDone.stat,
      row: () =>
        t.run(
          async (ctx) =>
            (await ctx.db
              .query("teamSnapshots")
              .withIndex("by_org", (q) => q.eq("orgId", orgId))
              .unique())!,
        ),
    };
  };

  // Raised from 5 to 7: a total shown at n 6 hides until 7 respond.
  const raised = await teamOfSix(5);
  expect(await raised.stat()).toEqual(shown(0, 6));
  await raised.setThreshold(7);
  expect(await raised.stat()).toEqual({
    kind: "hidden",
    helper: "Hidden until 7 responses",
  });

  // Taken at 7 with n 6, so stored without a value. Lowered to 5, n 6 would
  // clear it, but there is no value to show: it says when there will be one,
  // never the stale "Hidden until 7 responses".
  const lowered = await teamOfSix(7);
  const row = await lowered.row();
  expect(row).toMatchObject({
    threshold: 7,
    sessionDone: { hidden: true, n: 6 },
  });
  expect(row.counted).toHaveLength(6);
  expect(await lowered.stat()).toEqual({
    kind: "hidden",
    helper: "Hidden until 7 responses",
  });
  await lowered.setThreshold(5);
  expect(await lowered.stat()).toEqual({
    kind: "hidden",
    helper: "Shown from next week's totals",
  });
});

test("a hidden row's helper never depends on how many answered (threshold probe)", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  /** Week 1's row taken at 7 with `n` seated, then read at `now`. */
  const helperAt = async (n: number, now: number) => {
    const t = harness();
    const { owner, orgId } = await workspace(t);
    await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 7 }));
    for (let i = 0; i < n; i++) await seat(t, orgId, `user_${i}`, []);
    const sprintId = await launchedSprint(t, orgId);
    await t.mutation(internal.snapshots.take, { orgId, sprintId });
    await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: now }));
    return (await owner.query(api.manager.overview, {}))!.team?.sessionDone
      .stat;
  };
  // Both rows are stored hidden. Were the helper to turn on n, stepping the
  // threshold down from 7 would read n back.
  for (const now of [5, 6]) {
    const fewer = await helperAt(4, now);
    expect(fewer, `at ${now}`).toEqual(await helperAt(6, now));
    expect(fewer).toEqual({
      kind: "hidden",
      helper: "Shown from next week's totals",
    });
  }
});

test("the final row's helper never depends on how many answered (threshold probe)", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  /** The outcomes row taken at 7 with `n` seated, then read at `now`. */
  const finalAt = async (n: number, now: number) => {
    const t = harness();
    const { owner, orgId } = await workspace(t);
    await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 7 }));
    for (let i = 0; i < n; i++) await seat(t, orgId, `user_${i}`, []);
    const sprintId = await launchedSprint(t, orgId);
    await t.mutation(internal.snapshots.take, { orgId, sprintId });
    vi.setSystemTime(mel("2026-10-02T09:00"));
    await t.mutation(internal.snapshots.takeOutcomes, { sprintId });
    vi.setSystemTime(mel("2026-09-10T09:00"));
    await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: now }));
    return await owner.query(api.manager.outcomes, {});
  };
  for (const now of [5, 6]) {
    const fewer = await finalAt(4, now);
    expect(fewer, `at ${now}`).toMatchObject({ state: "closed" });
    // Invited now counts the seated team (R-c), so it follows n; the rest
    // of the row must not.
    const more = await finalAt(6, now);
    const split = (r: typeof fewer) => {
      if (r?.state !== "closed") throw new Error("expected a closed row");
      const { participation, ...rest } = r;
      const { invited, ...others } = participation;
      return { invited, rest: { ...rest, participation: others } };
    };
    expect(split(fewer).invited, `at ${now}`).toBe(4);
    expect(split(more).invited, `at ${now}`).toBe(6);
    expect(split(fewer).rest, `at ${now}`).toEqual(split(more).rest);
    expect(JSON.stringify(fewer)).toContain("Hidden until 7 responses");
  }
});

test("a row shown at 5 hides when the threshold is raised and shows again when it is lowered", async () => {
  vi.setSystemTime(mel("2026-09-10T09:00"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  for (const subject of ["a", "b", "c", "d", "e", "f"]) {
    await seat(t, orgId, `user_${subject}`, []);
  }
  const sprintId = await launchedSprint(t, orgId);
  await t.mutation(internal.snapshots.take, { orgId, sprintId });
  const stat = async () =>
    (await owner.query(api.manager.overview, {}))!.team?.sessionDone.stat;
  const setThreshold = (threshold: number) =>
    owner.mutation(api.workspace.setThreshold, {
      threshold,
      expectOrgId: orgId,
    });

  expect(await stat()).toEqual(shown(0, 6));
  await setThreshold(8);
  expect(await stat()).toEqual({
    kind: "hidden",
    helper: "Hidden until 8 responses",
  });
  // Shown under its own stored threshold, so its value was kept.
  await setThreshold(5);
  expect(await stat()).toEqual(shown(0, 6));
});

test("week 4's row has no next week, so a lowered threshold names the one it was taken under (Q-2)", async () => {
  const { t, orgId, as } = await calderLane();
  // Seven are seated, so at 8 every week's row is stored hidden, n 7.
  await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 8 }));
  await move(t, "complete");
  // Lowered after the close: 7 would clear 5, but no value was stored, and
  // no weekly row comes after week 4 to show it.
  await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 5 }));
  const hidden = { kind: "hidden", helper: "Hidden until 8 responses" };
  const overview = await as("priya").query(api.manager.overview, {});
  expect(overview).toMatchObject({
    phase: "complete",
    sprint: { projects: hidden },
    team: {
      sessionDone: { label: "Week 4 session done", stat: hidden },
      tasksUnderway: { stat: hidden },
    },
  });
  expect(JSON.stringify(overview)).not.toContain(
    "Shown from next week's totals",
  );
});
