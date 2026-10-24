import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  CREDENTIALS,
  LESSONS,
  TARGETS,
  lessonsFor,
} from "../lib/careers/catalog";
import { careerMutation, careerQuery } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { addDays, mondayOf } from "../lib/sprintTime";
import { crewOf, crewWeek, learnerOf } from "./crews";

async function completionsOf(
  ctx: QueryCtx | MutationCtx,
  careerProfileId: Id<"careerProfiles">,
) {
  return await ctx.db
    .query("lessonProgress")
    .withIndex("by_careerProfile", (q) =>
      q.eq("careerProfileId", careerProfileId),
    )
    .collect();
}

/** The crew week shown: week 1 before the crew starts. */
const weekShown = (crew: Doc<"crews">, now: number) =>
  Math.max(1, crewWeek(crew, now));

/** "YYYY-MM-DD" of the crew's `week` (1 is the first) at `day` (0 is Sunday). */
const dateIn = (crew: Doc<"crews">, week: number, day: number) =>
  addDays(mondayOf(crew.startsOn), 7 * (week - 1) + ((day + 6) % 7));

const lesson = v.object({
  lessonId: v.string(),
  title: v.string(),
  minutes: v.number(),
  kind: v.union(v.literal("lesson"), v.literal("project")),
  hasAudio: v.boolean(),
  done: v.boolean(),
});

/** Screens 5 and D5: this week's lessons, the credential's count and the check-in. */
export const thisWeek = careerQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      credentialId: v.string(),
      credentialName: v.string(),
      // "Credential 1 of 3".
      credentialNumber: v.number(),
      credentialCount: v.number(),
      week: v.number(),
      done: v.number(),
      total: v.number(),
      lessons: v.array(lesson),
      comingUp: v.union(
        v.null(),
        v.object({ opensOn: v.string(), lessons: v.array(lesson) }),
      ),
      checkIn: v.object({ date: v.string(), time: v.string() }),
      listenInstead: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") return null;
    const joined = await crewOf(ctx, profile._id);
    if (!joined) return null;
    const { crew } = joined;
    const week = weekShown(crew, ctx.career.now);
    const all = lessonsFor(crew.credentialId);
    const done = new Set(
      (await completionsOf(ctx, profile._id)).map((l) => l.lessonId),
    );
    const of = (w: number) =>
      all
        .filter((l) => l.week === w)
        .map((l) => ({
          lessonId: l.id,
          title: l.title,
          minutes: l.minutes,
          kind: l.kind,
          hasAudio: l.hasAudio,
          done: done.has(l.id),
        }));
    const next = of(week + 1);
    const skills = TARGETS.find((t) => t.id === crew.targetRole)!.skills;
    const settings = await ctx.db
      .query("careerSettings")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .unique();
    return {
      credentialId: crew.credentialId,
      credentialName: CREDENTIALS.find((c) => c.id === crew.credentialId)!.name,
      credentialNumber:
        skills.findIndex((s) => s.credentialId === crew.credentialId) + 1,
      credentialCount: skills.length,
      week,
      done: all.filter((l) => done.has(l.id)).length,
      total: all.length,
      lessons: of(week),
      comingUp: next.length
        ? { opensOn: dateIn(crew, week + 1, 1), lessons: next }
        : null,
      checkIn: {
        date: dateIn(crew, week, crew.checkInDay),
        time: crew.checkInTime,
      },
      listenInstead: settings?.listenInstead ?? false,
    };
  },
});

/** Ticks a lesson off. Ticking it again keeps the first time. */
export const completeLesson = careerMutation({
  args: { lessonId: v.string() },
  returns: v.null(),
  handler: async (ctx, { lessonId }) => {
    const profile = learnerOf(ctx.career);
    if (!LESSONS.some((l) => l.id === lessonId)) {
      throwUserError("NOT_FOUND", "That no longer exists.");
    }
    const done = (await completionsOf(ctx, profile._id)).some(
      (l) => l.lessonId === lessonId,
    );
    if (!done) {
      await ctx.db.insert("lessonProgress", {
        careerProfileId: profile._id,
        lessonId,
        completedAt: ctx.career.now,
      });
    }
    return null;
  },
});

/** "Low energy? Listen instead". */
export const setListen = careerMutation({
  args: { on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { on }) => {
    const profile = learnerOf(ctx.career);
    const settings = await ctx.db
      .query("careerSettings")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .unique();
    if (!settings) throwUserError("NOT_FOUND", "That no longer exists.");
    await ctx.db.patch(settings._id, { listenInstead: on });
    return null;
  },
});

/**
 * Screen 7's banner, for the learner only (P6): after a week with no lesson
 * finished, or with the demo's `missedWeek` flag, where to pick up this week.
 * Worked out from completion dates now; nothing about a missed week is stored.
 */
export const reentry = careerQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      lessonId: v.string(),
      title: v.string(),
      minutes: v.number(),
      // "Pick up at lesson 2 of 4".
      position: v.number(),
      of: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") return null;
    const joined = await crewOf(ctx, profile._id);
    if (!joined) return null;
    const { crew } = joined;
    const week = weekShown(crew, ctx.career.now);
    const completions = await completionsOf(ctx, profile._id);
    const demo = await ctx.db.query("careerDemo").first();
    const missed =
      (demo?.missedWeek ?? false) ||
      (week > 1 &&
        !completions.some((l) => crewWeek(crew, l.completedAt) === week - 1));
    if (!missed) return null;
    const done = new Set(completions.map((l) => l.lessonId));
    const lessons = lessonsFor(crew.credentialId).filter(
      (l) => l.week === week,
    );
    const at = lessons.findIndex((l) => !done.has(l.id));
    if (at < 0) return null;
    const next = lessons[at]!;
    return {
      lessonId: next.id,
      title: next.title,
      minutes: next.minutes,
      position: at + 1,
      of: lessons.length,
    };
  },
});
