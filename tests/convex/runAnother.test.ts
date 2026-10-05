import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEMO_TARGETS, mel } from "../../convex/lib/demo/schedule";
import { loadSeated } from "../../convex/lib/privacy";
import { calderLane, seat, type T } from "./workspace/helpers";
import {
  clockAt,
  launchClone,
  move,
  personOf,
  sprintsOf,
} from "./sprintHelpers";

/**
 * "Run another sprint" (P7a Rulings 14 to 17). The draft clone opens setup
 * and blanks no employee page; once launched, it is the sprint they read.
 */

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function agreementsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("agreements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

async function invitesOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

const NOT_CLOSED = {
  data: {
    code: "SPRINT_NOT_CLOSED",
    message: "You can run another sprint once this one has closed.",
  },
};
const DRAFT_EXISTS = {
  data: {
    code: "SPRINT_DRAFT_EXISTS",
    message: "Your next sprint is already in setup.",
  },
};

test("employees read the newest launched sprint", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "complete");
  const dan = as("dan");
  const reads = async () => ({
    home: await dan.query(api.me.home, {}),
    sprint: await dan.query(api.me.sprint, {}),
    project: await dan.query(api.projects.mine, {}),
    board: await dan.query(api.showAndTell.board, {}),
    shell: await dan.query(api.viewer.shell, {}),
  });
  const before = await reads();
  for (const [name, value] of Object.entries(before)) {
    expect(value, name).not.toBeNull();
  }

  await as("priya").mutation(api.sprints.runAnother, { expectOrgId: orgId });
  expect(await sprintsOf(t, orgId)).toHaveLength(2);
  // The draft clone blanks nothing: every read stays on sprint 1.
  expect(await reads()).toEqual(before);
  expect(
    await dan.mutation(api.learning.continueSession, { expectOrgId: orgId }),
  ).toMatchObject({ sessionsDone: 4, badgeIssued: false });

  // Launched, the clone is the newest launched sprint, and the reads move to it.
  await launchClone(t, orgId);
  expect(await dan.query(api.projects.mine, {})).toMatchObject({
    project: null,
  });
  expect((await dan.query(api.me.home, {}))?.intro).not.toBe(
    before.home?.intro,
  );
  const after = await reads();
  expect(after.sprint?.calendar.startDate).not.toBe(
    before.sprint?.calendar.startDate,
  );
  expect(after.sprint?.weeks[0]?.date).toMatch(/November/);
  expect(after.board).not.toEqual(before.board);
  expect(after.shell?.status).not.toEqual(before.shell?.status);
});

test("runAnother is refused until the sprint has closed", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await move(t, "week4");
  await expect(
    priya.mutation(api.sprints.runAnother, { expectOrgId: orgId }),
  ).rejects.toMatchObject(NOT_CLOSED);
  // Past closesAt (Thursday 1 October, 3:00 PM), but no outcomes row yet:
  // a patched clock runs no snapshot. runAnother writes the missed row itself.
  await clockAt(t, orgId, mel("2026-10-01T15:30"));
  const outcomeRows = () =>
    t.run((ctx) => ctx.db.query("sprintOutcomes").collect());
  const [first] = await sprintsOf(t, orgId);
  expect(
    (await outcomeRows()).filter((r) => r.sprintId === first!._id),
  ).toHaveLength(0);
  expect(
    await priya.mutation(api.sprints.runAnother, { expectOrgId: orgId }),
  ).toEqual({ href: "/setup/protected-hour" });
  expect(
    (await outcomeRows()).filter((r) => r.sprintId === first!._id),
  ).toHaveLength(1);
  expect(await sprintsOf(t, orgId)).toHaveLength(2);
});

test("runAnother refuses a second draft", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  // Setup: the newest sprint is the first one, still a draft.
  await expect(
    priya.mutation(api.sprints.runAnother, { expectOrgId: orgId }),
  ).rejects.toMatchObject(DRAFT_EXISTS);
  await move(t, "complete");
  await priya.mutation(api.sprints.runAnother, { expectOrgId: orgId });
  await expect(
    priya.mutation(api.sprints.runAnother, { expectOrgId: orgId }),
  ).rejects.toMatchObject(DRAFT_EXISTS);
  expect(await sprintsOf(t, orgId)).toHaveLength(2);
});

test("runAnother copies the agreement as a new draft version and no invitations", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await move(t, "complete");
  const invitesBefore = await invitesOf(t, orgId);
  const agreementsBefore = await agreementsOf(t, orgId);
  const saved = agreementsBefore
    .filter((a) => a.status === "saved")
    .sort((a, b) => b.version - a.version)[0]!;
  // The saved version is on top, so it is the one copied.
  expect(Math.max(...agreementsBefore.map((a) => a.version))).toBe(
    saved.version,
  );

  expect(
    await priya.mutation(api.sprints.runAnother, { expectOrgId: orgId }),
  ).toEqual({ href: "/setup/protected-hour" });

  const [first, clone, ...rest] = await sprintsOf(t, orgId);
  expect(rest).toEqual([]);
  expect(clone).toMatchObject({
    orgId,
    teamId: first!.teamId,
    // The first Wednesday of the month after Thursday 1 October.
    startDate: "2026-11-04",
    timeZone: first!.timeZone,
    weeks: first!.weeks,
    protectedHour: first!.protectedHour,
    courseTitle: first!.courseTitle,
    createdAt: DEMO_TARGETS.complete,
  });
  for (const field of [
    "launchedAt",
    "committedAt",
    "notReady",
    "inviteMessage",
    "completedAt",
  ] as const) {
    expect(clone![field], field).toBeUndefined();
  }
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("teams")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
    ),
  ).toHaveLength(1);

  const agreementsAfter = await agreementsOf(t, orgId);
  expect(agreementsAfter).toHaveLength(agreementsBefore.length + 1);
  const top = agreementsAfter.find((a) => a.version === saved.version + 1);
  expect(top).toMatchObject({
    orgId,
    teamId: saved.teamId,
    status: "draft",
    tools: saved.tools,
    neverIn: saved.neverIn,
    checks: saved.checks,
    escalation: saved.escalation,
    contact: saved.contact,
  });
  expect(top?.savedAt).toBeUndefined();
  expect(top?.savedBy).toBeUndefined();

  const invitesAfter = await invitesOf(t, orgId);
  expect(invitesAfter).toEqual(invitesBefore);
  expect(invitesAfter.some((i) => i.sprintId === clone!._id)).toBe(false);

  // Setup opens on the clone at 04, in the month it pinned (Ruling 14).
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    sprintId: clone!._id,
    weekday: 3,
    start: "14:00",
    startDate: "2026-11-04",
    weekOneMonday: "2026-11-02",
    committed: false,
    launched: false,
    phase: "draft",
  });
  // A new day keeps the pinned week.
  await priya.mutation(api.sprints.setProtectedHour, {
    weekday: 5,
    start: "14:00",
    expectOrgId: orgId,
  });
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    startDate: "2026-11-06",
    weekOneMonday: "2026-11-02",
  });

  // 16 stays on sprint 1, and the button goes: the newest sprint is the clone.
  expect(await priya.query(api.manager.outcomes, {})).toMatchObject({
    state: "closed",
    canRunAnother: false,
  });
});

test("an employee without sprint:manage cannot run another sprint", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "complete");
  const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
  for (const who of [as("dan"), lead]) {
    await expect(
      who.mutation(api.sprints.runAnother, { expectOrgId: orgId }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  }
  expect(await sprintsOf(t, orgId)).toHaveLength(1);
});

test("attachReflection in sprint 2 relinks the one badge", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  await move(t, "complete");
  const danId = await personOf(t, orgId, "dan");
  const [first] = await sprintsOf(t, orgId);
  const sprintOne = (await t.run((ctx) =>
    ctx.db
      .query("projects")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", danId).eq("sprintId", first!._id),
      )
      .unique(),
  ))!;
  expect(sprintOne.status).toBe("saved");
  // A known start: the badge links sprint 1's project.
  await dan.mutation(api.badges.attachReflection, { expectOrgId: orgId });

  await as("priya").mutation(api.sprints.runAnother, { expectOrgId: orgId });
  // A draft clone changes nothing.
  expect((await dan.query(api.badges.mine, {}))?.reflection?.project).toBe(
    sprintOne.title,
  );

  const cloneId = await launchClone(t, orgId);
  const sprintTwo = await t.run((ctx) =>
    ctx.db.insert("projects", {
      orgId,
      personId: danId,
      sprintId: cloneId,
      startedWeek: 1,
      title: "Sprint 2 client brief",
      before: "Two hours a brief.",
      change: "A drafting prompt.",
      after: "Forty minutes a brief.",
      resultTypes: [],
      humanReviewed: true,
      dataSafe: true,
      status: "saved",
      sharing: "private",
      autosavedAt: mel("2026-10-01T17:00"),
    }),
  );
  await dan.mutation(api.badges.attachReflection, { expectOrgId: orgId });

  const badges = await t.run((ctx) =>
    ctx.db
      .query("badges")
      .withIndex("by_person", (q) => q.eq("personId", danId))
      .collect(),
  );
  expect(badges).toHaveLength(1);
  expect(badges[0]!.reflectionProjectId).toBe(sprintTwo);
  expect((await dan.query(api.badges.mine, {}))?.reflection).toMatchObject({
    project: "Sprint 2 client brief",
    application: "Forty minutes a brief.",
  });
});

test("the before check-in shows on /me only from sprint 2, in week 1, until answered or skipped", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  const mei = as("mei");
  const asked = async (who: typeof dan) =>
    (await who.query(api.me.home, {}))?.beforeCheckIn;

  // Sprint 1 asks at join (P6 Ruling 7), never on /me, even with no before rows.
  await move(t, "week1");
  const danId = await personOf(t, orgId, "dan");
  await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", danId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  });
  expect(await asked(dan)).toBe(false);

  await move(t, "complete");
  await as("priya").mutation(api.sprints.runAnother, { expectOrgId: orgId });
  // The clone is a draft: Dan is still on sprint 1.
  expect(await asked(dan)).toBe(false);

  await launchClone(t, orgId);
  // Week one is the week of Monday 2 November.
  await clockAt(t, orgId, Date.parse("2026-10-20T12:00:00+11:00"));
  expect(await asked(dan)).toBe(true);
  await clockAt(t, orgId, Date.parse("2026-11-04T13:00:00+11:00"));
  expect(await asked(dan)).toBe(true);
  expect(await asked(mei)).toBe(true);
  await clockAt(t, orgId, Date.parse("2026-11-09T09:00:00+11:00"));
  expect(await asked(dan)).toBe(false);

  // An answer ends it, and so does a skip (Ruling 6 writes a skip as rows).
  await clockAt(t, orgId, Date.parse("2026-11-04T13:00:00+11:00"));
  await dan.mutation(api.surveys.checkIn, {
    phase: "before",
    answers: { aiConfidence: 3, comfortWithManager: 4 },
    expectOrgId: orgId,
  });
  expect(await asked(dan)).toBe(false);
  await mei.mutation(api.surveys.checkIn, {
    phase: "before",
    answers: null,
    expectOrgId: orgId,
  });
  expect(await asked(mei)).toBe(false);
  // The save refuses a second, by the same rule.
  await expect(
    dan.mutation(api.surveys.checkIn, {
      phase: "before",
      answers: null,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "CHECK_IN_DONE" } });
});

test("a clone launches with no new addresses and counts the carried team", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await move(t, "complete");
  await priya.mutation(api.sprints.runAnother, { expectOrgId: orgId });
  const clone = (await sprintsOf(t, orgId))[1]!;
  // What 04 does when the hour is committed.
  await t.run((ctx) =>
    ctx.db.patch(clone._id, { committedAt: mel("2026-10-01T17:00") }),
  );
  await priya.mutation(api.sprints.launch, {
    emails: [],
    message: "",
    expectOrgId: orgId,
  });
  const seated = await t.run(
    async (ctx) => (await loadSeated(ctx, (await ctx.db.get(orgId))!)).length,
  );
  expect(seated).toBeGreaterThan(0);
  const overview = await priya.query(api.manager.overview, {});
  expect(overview?.sprint).toMatchObject({ invited: seated, joined: seated });
  // 16 is pending on the scheduled clone, titled as 08 titles it.
  expect(overview?.phase).toBe("scheduled");
  expect(await priya.query(api.manager.outcomes, {})).toMatchObject({
    state: "pending",
    title: "Starts 4 Nov",
  });
});

test("the before check-in closes after week 1 of a later sprint", async () => {
  const { t, orgId, as } = await calderLane();
  const dan = as("dan");
  const mei = as("mei");
  await move(t, "complete");
  await as("priya").mutation(api.sprints.runAnother, { expectOrgId: orgId });
  await launchClone(t, orgId);
  const answer = (who: typeof dan) =>
    who.mutation(api.surveys.checkIn, {
      phase: "before",
      answers: { aiConfidence: 3, comfortWithManager: 4 },
      expectOrgId: orgId,
    });
  await clockAt(t, orgId, Date.parse("2026-11-09T09:00:00+11:00"));
  await expect(answer(dan)).rejects.toMatchObject({
    data: {
      code: "CHECK_IN_CLOSED",
      message: "The before check-in has closed.",
    },
  });
  await clockAt(t, orgId, Date.parse("2026-11-04T13:00:00+11:00"));
  expect(await answer(mei)).toBeNull();
});

test("the join facts ask the before check-in only while it is open", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const asks = async () =>
    (await priya.query(api.invites.teamPreview, {}))?.join.askBefore;
  // Sprint 1 asks at join, whatever the week.
  await move(t, "week2");
  expect(await asks()).toBe(true);
  await move(t, "complete");
  await priya.mutation(api.sprints.runAnother, { expectOrgId: orgId });
  await launchClone(t, orgId);
  await clockAt(t, orgId, Date.parse("2026-11-04T13:00:00+11:00"));
  expect(await asks()).toBe(true);
  // Week 2 of sprint 2: the save would refuse, so the join page must not ask.
  await clockAt(t, orgId, Date.parse("2026-11-09T09:00:00+11:00"));
  expect(await asks()).toBe(false);
});

test("a sprint 1 before answer is still accepted in week 2", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const danId = await personOf(t, orgId, "dan");
  await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", danId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  });
  expect(
    await as("dan").mutation(api.surveys.checkIn, {
      phase: "before",
      answers: { aiConfidence: 3, comfortWithManager: 4 },
      expectOrgId: orgId,
    }),
  ).toBeNull();
});
