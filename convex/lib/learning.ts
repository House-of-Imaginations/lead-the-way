import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** AI Productivity Fundamentals: 4 sessions of 15 minutes (spec 7.3). */
export const COURSE_SESSIONS = 4;

/**
 * The session a week is for. Before week one it is session 1, and after the
 * last week it stays at the last session.
 */
export const sessionOf = (week: number) =>
  Math.min(Math.max(week, 1), COURSE_SESSIONS);

/** The person's own course progress: one row per person and sprint (writer contract). */
export async function progressOf(
  ctx: QueryCtx,
  personId: Id<"people">,
  sprintId: Id<"sprints">,
): Promise<Doc<"learningProgress"> | null> {
  return await ctx.db
    .query("learningProgress")
    .withIndex("by_person_and_sprint", (q) =>
      q.eq("personId", personId).eq("sprintId", sprintId),
    )
    .unique();
}

/**
 * Completed the course (Ruling 2): the person's progress row for that sprint
 * reads 100 percent. Never `sessionsDone >= COURSE_SESSIONS`, and never "has a
 * badge": a badge is per person (R-c), so after another sprint it says
 * nothing about this one. The demo's `dan.badge` writes 100 with 3 sessions.
 */
export const completedCourse = (
  progress: Pick<Doc<"learningProgress">, "percent"> | null,
) => progress?.percent === 100;
