import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf, type CastKey } from "../../convex/lib/demo/cast";
import {
  DEMO_TARGETS,
  mel,
  type DemoTarget,
} from "../../convex/lib/demo/schedule";
import { ROUTE_PERMISSION } from "../../convex/lib/orgs/permissions";
import { closesAt } from "../../convex/lib/sprintTime";
import { calderLane, seat, type T } from "./workspace/helpers";

/**
 * P7a Task 4: closing a sprint, its one outcomes row, and 16's read of it
 * (Rulings 9 to 12, R-i). The numbers come from the demo script's cast
 * (convex/lib/demo/script.ts): seven seated, five answer before and seven
 * after, six present.
 */

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const move = (t: T, target: DemoTarget) =>
  t.mutation(internal.seed.clock, { target });

/**
 * The real backstop run, and the outcomes run it schedules (GB-M1). Timers
 * are fake, so the scheduled run fires only when drained here.
 */
async function backstop(t: T, orgId: Id<"orgs">, sprintId: Id<"sprints">) {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  await t.mutation(internal.snapshots.take, { orgId, sprintId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

/** The demo clock set directly: no scripted step runs and no total is taken. */
const clockAt = (t: T, orgId: Id<"orgs">, local: string) =>
  t.run((ctx) => ctx.db.patch(orgId, { demoNow: mel(local) }));

const shown = (value: number, of: number) =>
  ({ kind: "shown", value, of }) as const;
const hidden = (helper: string) => ({ kind: "hidden", helper }) as const;

const PENDING_HELPER =
  "Outcomes appear on Thu 1 Oct, the day after the last protected hour.";
const INVITE_LINK = "/signup?ref=calder-lane";
/** The script's six presented projects, in PROJECT_CATEGORIES order. */
const CATEGORIES = [
  { label: "Reporting and drafting", count: 2 },
  { label: "Email workflows", count: 1 },
  { label: "Meeting notes", count: 1 },
  { label: "Analysis", count: 2 },
];
const ANSWERS = { aiConfidence: 4, comfortWithManager: 4 };

async function personOf(t: T, orgId: Id<"orgs">, key: CastKey) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

async function sprintIdOf(t: T, orgId: Id<"orgs">) {
  return await t.run(
    async (ctx) =>
      (await ctx.db
        .query("sprints")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first())!._id,
  );
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

/** The sprint's one outcomes row; `unique` throws if there were two. */
async function outcomesRow(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("sprintOutcomes")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
  );
}

test("a sprint closes a day after its last hour, when the launch's backstop run is due", () => {
  const sprint = {
    startDate: "2026-09-09",
    timeZone: "Australia/Melbourne",
    weeks: 4,
    protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
  };
  expect(closesAt(sprint)).toBe(mel("2026-10-01T15:00"));
  // The demo's complete jump lands an hour after it, so it takes the row.
  expect(DEMO_TARGETS.complete).toBe(mel("2026-10-01T16:00"));
  // Across Melbourne's clock change on 4 October: 3:00 PM AEDT on the 14th,
  // plus a day, the time snapshots.test.ts pins for the backstop run.
  expect(closesAt({ ...sprint, startDate: "2026-09-23" })).toBe(
    Date.parse("2026-10-15T04:00:00.000Z"),
  );
});

test("the demo's outcomes match the spec", async () => {
  // A fresh Calder Lane is what seed:reset writes.
  const { t, orgId, as } = await calderLane();
  await move(t, "complete");
  const out = await as("priya").query(api.manager.outcomes, {});
  expect(out).toEqual({
    state: "closed",
    title: "Sprint complete",
    tag: "Finished 30 Sep",
    intro:
      "Your team made AI learning part of the working week. Here is what changed, as a team.",
    canRunAnother: true,
    inviteLink: INVITE_LINK,
    participation: {
      invited: 8,
      completed: shown(7, 7),
      presented: shown(6, 7),
    },
    beforeAfter: {
      caption: "Team average on a 1 to 5 scale, 5 responses before and 7 after",
      beforeLabel: "Before, 8 Sep",
      afterLabel: "After, 30 Sep",
      questions: [
        {
          title: "Confidence using AI at work",
          quote: null,
          before: shown(2.8, 5),
          after: shown(4, 7),
        },
        {
          title: "Comfort discussing AI with my manager",
          quote: "I feel comfortable telling my manager how I use AI at work.",
          before: shown(2.6, 5),
          after: shown(3.9, 7),
        },
      ],
    },
    projects: { caption: "6 projects completed", categories: CATEGORIES },
  });
  // Ruling FX: who a row counted, or seated, never leaves Convex.
  expect(JSON.stringify(out)).not.toMatch(/counted|seated|personId|email/);

  // One row, taken by the jump to complete, under the threshold of the day.
  const row = (await outcomesRow(t, orgId))!;
  expect(row.takenAt).toBe(DEMO_TARGETS.complete);
  expect(row.threshold).toBe(5);
  expect(row.counted).toHaveLength(7);
  // The public roster when taken: the seven seated, never Priya.
  expect(row.seated).toHaveLength(7);
  expect(row.seated).not.toContain(await personOf(t, orgId, "priya"));
  // A later run (the real backstop) adds nothing and changes nothing.
  await backstop(t, orgId, row.sprintId);
  expect(await outcomesRow(t, orgId)).toEqual(row);
});

test("outcome averages count answers only, from counted people", async () => {
  const { t, orgId, as } = await calderLane();
  // Week 1, before its hour ends: everyone has joined and no total is taken
  // yet, so every stored row counts the same people. Keep these changes
  // here: made after any weekly row, they would hide the outcomes as a
  // cohort change (Ruling FX) instead of testing what counts.
  await move(t, "week1");
  const sprintId = await sprintIdOf(t, orgId);
  // Aisha answered before (8 September) and opts out of team totals.
  await optOut(t, orgId, await personOf(t, orgId, "aisha"));
  // Luca skips: rows with no score, which are not answers.
  const luca = await personOf(t, orgId, "luca");
  // A coordinator who manages the sprint answers too. Managers never count
  // (Ruling 1), and Priya's own normsConfidence is not asked here.
  const { personId: coordinator } = await seat(t, orgId, "user_coordinator", [
    "sprint:manage",
  ]);
  await t.run(async (ctx) => {
    for (const question of ["aiConfidence", "comfortWithManager"] as const) {
      await ctx.db.insert("surveyResponses", {
        orgId,
        sprintId,
        personId: luca,
        phase: "before",
        question,
        skippedAt: DEMO_TARGETS.week1,
      });
      await ctx.db.insert("surveyResponses", {
        orgId,
        sprintId,
        personId: coordinator,
        phase: "before",
        question,
        score: 5,
      });
    }
  });
  await move(t, "complete");

  const row = (await outcomesRow(t, orgId))!;
  expect(row.counted).not.toContain(coordinator);
  // Before: Dan, Sarah, Mei and Tomás. 4 responses are below 5, so hidden,
  // with no value stored. After: the six who count (Aisha is out), so
  // confidence 24 / 6 and comfort 23 / 6.
  expect(row.answers).toEqual([
    {
      question: "aiConfidence",
      before: { hidden: true, n: 4 },
      after: { hidden: false, n: 6, value: 4 },
    },
    {
      question: "comfortWithManager",
      before: { hidden: true, n: 4 },
      after: { hidden: false, n: 6, value: 3.8 },
    },
  ]);
  const before = hidden("Hidden until 5 responses");
  expect(await as("priya").query(api.manager.outcomes, {})).toMatchObject({
    state: "closed",
    beforeAfter: {
      caption: "Team average on a 1 to 5 scale, 6 responses after",
      questions: [
        { before, after: shown(4, 6) },
        { before, after: shown(3.8, 6) },
      ],
    },
  });
});

test("presented counts every seated presenter, opted out or not", async () => {
  const { t, orgId, as } = await calderLane();
  // Opted out at the week 1 target, before week 1's hour ends, so every row
  // counts the same six and the outcomes row stays comparable (Ruling FX).
  // Moved later, 16 would read "Hidden after a change to who is counted".
  await move(t, "week1");
  await optOut(t, orgId, await personOf(t, orgId, "mei"));
  await move(t, "complete");

  const row = (await outcomesRow(t, orgId))!;
  expect(row.counted).toHaveLength(6);
  // Private activity counts the six who count (spec rule 5) ...
  expect(row.completed).toEqual({ hidden: false, n: 6, value: 6 });
  // ... but presenting is public, so all seven seated count, Mei too (R-i).
  expect(row.presented).toEqual({ hidden: false, n: 7, value: 6 });
  expect(row.categories).toEqual(CATEGORIES);

  expect(await as("priya").query(api.manager.outcomes, {})).toMatchObject({
    participation: {
      invited: 8,
      completed: shown(6, 6),
      presented: shown(6, 7),
    },
    projects: { caption: "6 projects completed", categories: CATEGORIES },
  });
});

test("outcomes hide averages under the threshold", async () => {
  const { t, orgId, as } = await calderLane();
  // Five answer before and seven after (spec 3.3). At 6 only after shows.
  await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 6 }));
  await move(t, "complete");

  const row = (await outcomesRow(t, orgId))!;
  expect(row.threshold).toBe(6);
  // A hidden average is stored with its n and no value at all.
  expect(row.answers).toEqual([
    {
      question: "aiConfidence",
      before: { hidden: true, n: 5 },
      after: { hidden: false, n: 7, value: 4 },
    },
    {
      question: "comfortWithManager",
      before: { hidden: true, n: 5 },
      after: { hidden: false, n: 7, value: 3.9 },
    },
  ]);
  const out = await as("priya").query(api.manager.outcomes, {});
  const before = hidden("Hidden until 6 responses");
  expect(out).toMatchObject({
    beforeAfter: {
      caption: "Team average on a 1 to 5 scale, 7 responses after",
      questions: [
        { before, after: shown(4, 7) },
        { before, after: shown(3.9, 7) },
      ],
    },
  });
  expect(JSON.stringify(out)).not.toMatch(/2\.8|2\.6/);

  // Lowered after the close: the five are still enough now, but no value was
  // stored, and the outcomes row has no next row to show it (Ruling 7, final).
  await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 5 }));
  const lowered = hidden("Hidden until 6 responses");
  expect(await as("priya").query(api.manager.outcomes, {})).toMatchObject({
    beforeAfter: {
      questions: [
        { before: lowered, after: shown(4, 7) },
        { before: lowered, after: shown(3.9, 7) },
      ],
    },
  });
});

test("a team under the threshold sees no outcome numbers at all", async () => {
  const { t, orgId, as } = await calderLane();
  // Seven are seated, so at 8 every total is hidden.
  await t.run((ctx) => ctx.db.patch(orgId, { privacyThreshold: 8 }));
  await move(t, "complete");

  const row = (await outcomesRow(t, orgId))!;
  expect(row.presented).toEqual({ hidden: true, n: 7 });
  // Ruling 10: no categories when presented is hidden, or they'd add up to it.
  expect(row.categories).toEqual([]);
  const none = hidden("Hidden until 8 responses");
  expect(await as("priya").query(api.manager.outcomes, {})).toMatchObject({
    state: "closed",
    participation: { invited: 8, completed: none, presented: none },
    beforeAfter: {
      caption: "Team average on a 1 to 5 scale",
      questions: [
        { before: none, after: none },
        { before: none, after: none },
      ],
    },
    projects: { caption: null, categories: [] },
  });
});

test("the after check-in closes when the outcomes are taken", async () => {
  const { t, orgId, as } = await calderLane();
  // 30 September, 1:00 PM: the script answers nobody's after check-in
  // until 3:30 PM, and the clock is set directly from here on.
  await move(t, "week4");
  const sprintId = await sprintIdOf(t, orgId);
  const dan = as("dan");
  const mei = as("mei");

  // A minute before the sprint closes, the card is still there and the
  // answer still lands.
  await clockAt(t, orgId, "2026-10-01T14:59");
  expect((await dan.query(api.me.home, {}))?.afterCheckIn).toBe(true);
  await dan.mutation(api.surveys.checkIn, {
    phase: "after",
    answers: ANSWERS,
    expectOrgId: orgId,
  });

  // At closesAt the backstop run takes the row.
  await clockAt(t, orgId, "2026-10-01T15:00");
  await backstop(t, orgId, sprintId);
  const row = (await outcomesRow(t, orgId))!;
  expect(row.takenAt).toBe(mel("2026-10-01T15:00"));
  // Dan's answer made it in: one response, so hidden.
  expect(row.answers.map((a) => a.after)).toEqual([
    { hidden: true, n: 1 },
    { hidden: true, n: 1 },
  ]);

  // From then on nobody is asked, and nobody can answer into a total that
  // will never change (Review Focus 4).
  expect((await mei.query(api.me.home, {}))?.afterCheckIn).toBe(false);
  expect((await mei.query(api.showAndTell.board, {}))?.afterCheckIn).toBe(
    false,
  );
  await expect(
    mei.mutation(api.surveys.checkIn, {
      phase: "after",
      answers: ANSWERS,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "CHECK_IN_CLOSED" } });
  const meiId = await personOf(t, orgId, "mei");
  const meiAfter = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("surveyResponses")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", meiId).eq("sprintId", sprintId),
        )
        .collect()
    ).filter((r) => r.phase === "after"),
  );
  expect(meiAfter).toEqual([]);
});

test("the backstop takes the outcomes in a run of its own, so a failure there keeps week 4's row (GB-M1)", async () => {
  const { t, orgId } = await calderLane();
  // Before week 4's hour ends, so its row is the backstop's to take.
  await move(t, "week4");
  const sprintId = await sprintIdOf(t, orgId);
  const weeks = () =>
    t.run(async (ctx) =>
      (
        await ctx.db
          .query("teamSnapshots")
          .withIndex("by_sprint_and_week", (q) => q.eq("sprintId", sprintId))
          .collect()
      ).map((r) => r.week),
    );
  expect(await weeks()).toEqual([1, 2, 3]);
  // Mei opts out, so the weeks no longer read her rows but the outcomes
  // writer still does (presented counts every seated presenter). A second
  // project for her makes its projectOf `.unique()` throw, and only there.
  const mei = await personOf(t, orgId, "mei");
  await optOut(t, orgId, mei);
  await t.run(async (ctx) => {
    const project = (await ctx.db
      .query("projects")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", mei).eq("sprintId", sprintId),
      )
      .first())!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, _creationTime, ...copy } = project;
    await ctx.db.insert("projects", copy);
  });

  await clockAt(t, orgId, "2026-10-01T15:00");
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  await t.mutation(internal.snapshots.take, { orgId, sprintId });
  // The weeks commit on their own; the outcomes run is only scheduled.
  expect(await weeks()).toEqual([1, 2, 3, 4]);
  expect(await outcomesRow(t, orgId)).toBeNull();
  const jobs = () =>
    t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").collect())
        .filter((job) => job.name === "snapshots:takeOutcomes")
        .map((job) => ({ args: job.args, state: job.state.kind })),
    );
  expect(await jobs()).toEqual([{ args: [{ sprintId }], state: "pending" }]);

  // The outcomes run throws, and takes nothing else with it.
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await jobs()).toEqual([{ args: [{ sprintId }], state: "failed" }]);
  expect(await weeks()).toEqual([1, 2, 3, 4]);
  expect(await outcomesRow(t, orgId)).toBeNull();

  // Fixed, the next run writes the one row, and a run after that adds none.
  await t.run(async (ctx) => {
    const extra = (
      await ctx.db
        .query("projects")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", mei).eq("sprintId", sprintId),
        )
        .collect()
    ).at(-1)!;
    await ctx.db.delete(extra._id);
  });
  await backstop(t, orgId, sprintId);
  await backstop(t, orgId, sprintId);
  expect(await outcomesRow(t, orgId)).toMatchObject({
    takenAt: mel("2026-10-01T15:00"),
  });
});

test("outcomes are pending until the sprint closes, and null before launch", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  // 1 September: the sprint isn't launched.
  expect(await priya.query(api.manager.outcomes, {})).toBeNull();

  const pending = {
    state: "pending",
    helper: PENDING_HELPER,
    canRunAnother: false,
    inviteLink: INVITE_LINK,
  };
  await move(t, "week4");
  expect(await priya.query(api.manager.outcomes, {})).toEqual({
    ...pending,
    title: "Sprint in progress",
  });
  // The last hour has ended, but the sprint closes a day later.
  await clockAt(t, orgId, "2026-10-01T14:59");
  expect(await priya.query(api.manager.outcomes, {})).toEqual({
    ...pending,
    title: "Sprint complete",
  });
  // The jump to complete takes the row.
  await move(t, "complete");
  expect(await priya.query(api.manager.outcomes, {})).toMatchObject({
    state: "closed",
  });
});

test("/manager/outcomes needs team:insights, as ROUTE_PERMISSION says", async () => {
  expect(ROUTE_PERMISSION["/manager/outcomes"]).toBe("team:insights");
  const { t, orgId, as } = await calderLane();
  await move(t, "complete");
  const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
  const { as: coordinator } = await seat(t, orgId, "user_coordinator", [
    "sprint:manage",
  ]);
  // A lead reads the totals but can't run the next sprint.
  expect(await lead.query(api.manager.outcomes, {})).toMatchObject({
    state: "closed",
    canRunAnother: false,
  });
  for (const caller of [coordinator, as("dan")]) {
    await expect(caller.query(api.manager.outcomes, {})).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    });
  }
});

test("manager.ts never counts: it imports neither count nor aggregate", () => {
  const source = readFileSync(
    new URL("../../convex/manager.ts", import.meta.url),
    "utf8",
  );
  const fromPrivacy = [
    ...source.matchAll(
      /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']\.\/lib\/privacy["']/g,
    ),
  ]
    .map((m) => m[1])
    .join(",");
  // Seen, so the check can't pass by missing the import line.
  expect(fromPrivacy).toMatch(/\b(?:thresholdOf|loadSeated)\b/);
  expect(fromPrivacy).not.toMatch(/\b(?:count|aggregate)\b/);
  expect(source).not.toMatch(
    /import\s*\*\s*as\s+\w+\s+from\s*["']\.\/lib\/privacy["']/,
  );
  expect(source).not.toMatch(/(?<![\w.$])(?:count|aggregate)\(/);
});
