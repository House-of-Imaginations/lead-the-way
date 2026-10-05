import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf } from "../../convex/lib/demo/cast";
import { DEMO_TARGETS, type DemoTarget } from "../../convex/lib/demo/schedule";
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
  vi.unstubAllEnvs();
});

const ANSWERS = { aiConfidence: 3, comfortWithManager: 2 };

/** Calder Lane at `target`, and Dan, who joined on 8 September. */
async function danAt(target: DemoTarget) {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target });
  const personId = await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf("dan").email)!._id;
  });
  return { t, orgId, dan: as("dan"), personId };
}

async function rowsOf(t: T, personId: Id<"people">) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("surveyResponses")
        .withIndex("by_person_and_sprint", (q) => q.eq("personId", personId))
        .collect()
    )
      .map(({ phase, question, score, skippedAt }) => ({
        phase,
        question,
        score,
        skippedAt,
      }))
      .sort((a, b) => a.question.localeCompare(b.question)),
  );
}

/** `survey.answered` rows logged at `at`. The script's own steps are never on the hour. */
async function answeredAt(t: T, orgId: Id<"orgs">, at: number) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("events")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
      .filter((e) => e.type === "survey.answered" && e.at === at)
      .map((e) => e.meta),
  );
}

test("Dan answers the before check-in once", async () => {
  // Week 1, 1:00 PM: Dan has joined; the script answers for him at 1:30 PM.
  const { t, orgId, dan, personId } = await danAt("week1");
  await dan.mutation(api.surveys.checkIn, {
    phase: "before",
    answers: ANSWERS,
    expectOrgId: orgId,
  });
  expect(await rowsOf(t, personId)).toEqual([
    {
      phase: "before",
      question: "aiConfidence",
      score: 3,
      skippedAt: undefined,
    },
    {
      phase: "before",
      question: "comfortWithManager",
      score: 2,
      skippedAt: undefined,
    },
  ]);
  expect(await answeredAt(t, orgId, DEMO_TARGETS.week1)).toEqual([
    { phase: "before" },
  ]);

  for (const answers of [ANSWERS, null]) {
    await expect(
      dan.mutation(api.surveys.checkIn, {
        phase: "before",
        answers,
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({ data: { code: "CHECK_IN_DONE" } });
  }
});

test("a skip writes a row per question, no score, and logs nothing", async () => {
  const { t, orgId, dan, personId } = await danAt("week1");
  await dan.mutation(api.surveys.checkIn, {
    phase: "before",
    answers: null,
    expectOrgId: orgId,
  });
  expect(await rowsOf(t, personId)).toEqual([
    {
      phase: "before",
      question: "aiConfidence",
      score: undefined,
      skippedAt: DEMO_TARGETS.week1,
    },
    {
      phase: "before",
      question: "comfortWithManager",
      score: undefined,
      skippedAt: DEMO_TARGETS.week1,
    },
  ]);
  expect(await answeredAt(t, orgId, DEMO_TARGETS.week1)).toEqual([]);
  // Skipped is done: the before check-in is shown once.
  await expect(
    dan.mutation(api.surveys.checkIn, {
      phase: "before",
      answers: ANSWERS,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "CHECK_IN_DONE" } });
});

test("the after check-in opens in week 4 and can't be skipped", async () => {
  const { t, orgId, dan, personId } = await danAt("week1");
  await expect(
    dan.mutation(api.surveys.checkIn, {
      phase: "after",
      answers: ANSWERS,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "CHECK_IN_CLOSED" } });

  // Wednesday 30 September, 1:00 PM: week 4, before the script's 3:30 PM answers.
  await t.mutation(internal.seed.clock, { target: "week4" });
  await expect(
    dan.mutation(api.surveys.checkIn, {
      phase: "after",
      answers: null,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  await dan.mutation(api.surveys.checkIn, {
    phase: "after",
    answers: { aiConfidence: 4, comfortWithManager: 5 },
    expectOrgId: orgId,
  });
  expect(
    (await rowsOf(t, personId)).filter((r) => r.phase === "after"),
  ).toEqual([
    {
      phase: "after",
      question: "aiConfidence",
      score: 4,
      skippedAt: undefined,
    },
    {
      phase: "after",
      question: "comfortWithManager",
      score: 5,
      skippedAt: undefined,
    },
  ]);
  expect(await answeredAt(t, orgId, DEMO_TARGETS.week4)).toEqual([
    { phase: "after" },
  ]);

  // Scored once, then done: no second submission overwrites it.
  await expect(
    dan.mutation(api.surveys.checkIn, {
      phase: "after",
      answers: { aiConfidence: 1, comfortWithManager: 1 },
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "CHECK_IN_DONE" } });
});

test("scores are whole numbers from 1 to 5", async () => {
  const { t, orgId, dan, personId } = await danAt("week1");
  for (const answers of [
    { aiConfidence: 0, comfortWithManager: 3 },
    { aiConfidence: 3, comfortWithManager: 6 },
    { aiConfidence: 2.5, comfortWithManager: 3 },
  ]) {
    await expect(
      dan.mutation(api.surveys.checkIn, {
        phase: "before",
        answers,
        expectOrgId: orgId,
      }),
    ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  }
  expect(await rowsOf(t, personId)).toEqual([]);
});

test("a person who joins before launch saves the before check-in into sprint 1", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as, personId } = await seat(t, orgId, "user_emp", []);
  // A draft's stored week one can lag the clock; 09 asks anyway, so the save must not refuse.
  const sprintId = await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    return await ctx.db.insert("sprints", {
      orgId,
      teamId: team._id,
      startDate: "2026-01-07",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: "AI Productivity Fundamentals",
      createdAt: 1,
    });
  });
  await as.mutation(api.surveys.checkIn, {
    phase: "before",
    answers: ANSWERS,
    expectOrgId: orgId,
  });
  const rows = await t.run((ctx) =>
    ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", personId))
      .collect(),
  );
  expect(
    rows
      .map(({ sprintId, phase, question, score }) => ({
        sprintId,
        phase,
        question,
        score,
      }))
      .sort((a, b) => a.question.localeCompare(b.question)),
  ).toEqual([
    { sprintId, phase: "before", question: "aiConfidence", score: 3 },
    { sprintId, phase: "before", question: "comfortWithManager", score: 2 },
  ]);
});

test("no sprint, no check-in", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as } = await seat(t, orgId, "user_emp", []);
  await expect(
    as.mutation(api.surveys.checkIn, {
      phase: "before",
      answers: ANSWERS,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "NO_SPRINT" } });
});
