import { v } from "convex/values";
import { crewOf, learnerOf } from "../lib/careers/crew";
import { careerMutation, careerQuery } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { addDays, dayOf, mondayOf } from "../lib/sprintTime";

/** P7: the only title a calendar hold ever has. */
const HOLD_TITLE = "Busy" as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkDays(days: number[]) {
  if (
    new Set(days).size !== days.length ||
    days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  ) {
    throwUserError("FIELD_REQUIRED", "Pick each day once.");
  }
}

/** Screen 4b: the hours chosen on the map and the saved learning days. */
export const mine = careerQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      hoursPerWeek: v.union(v.number(), v.null()),
      saved: v.union(
        v.null(),
        v.object({
          days: v.array(v.number()),
          startTime: v.string(),
          calendarHold: v.boolean(),
          holdTitle: v.union(v.literal(HOLD_TITLE), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") return null;
    const row = await ctx.db
      .query("protectedHours")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .unique();
    return {
      hoursPerWeek: profile.hoursPerWeek ?? null,
      saved: row && {
        days: row.days,
        startTime: row.startTime,
        calendarHold: row.calendarHold,
        holdTitle: row.calendarHold ? HOLD_TITLE : null,
      },
    };
  },
});

/**
 * Screen 4b's first 4 weeks from the crew's start, for days not yet saved:
 * each date, whether it is a learning day, and whether it is the check-in.
 */
export const weekPreview = careerQuery({
  args: { days: v.array(v.number()) },
  returns: v.union(
    v.null(),
    v.object({
      checkInTime: v.string(),
      weeks: v.array(
        v.array(
          v.object({
            date: v.string(),
            learning: v.boolean(),
            checkIn: v.boolean(),
          }),
        ),
      ),
    }),
  ),
  handler: async (ctx, { days }) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") return null;
    checkDays(days);
    const crew = await crewOf(ctx, profile);
    if (!crew) return null;
    const monday = mondayOf(crew.startsOn);
    const weeks = [0, 1, 2, 3].map((w) =>
      [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const date = addDays(monday, 7 * w + d);
        const day = dayOf(date);
        return {
          date,
          learning: days.includes(day),
          checkIn: day === crew.checkInDay,
        };
      }),
    );
    return { checkInTime: crew.checkInTime, weeks };
  },
});

/** "Save my hours": as many days as hours a week, a start time and the hold. */
export const save = careerMutation({
  args: {
    days: v.array(v.number()),
    startTime: v.string(),
    calendarHold: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { days, startTime, calendarHold }) => {
    const profile = learnerOf(ctx.career);
    checkDays(days);
    const want = profile.hoursPerWeek;
    if (want ? days.length !== want : days.length < 1 || days.length > 3) {
      throwUserError(
        "FIELD_REQUIRED",
        want
          ? `Pick ${want} ${want === 1 ? "day" : "days"}, 1 hour each.`
          : "Pick 1 to 3 days.",
      );
    }
    if (!TIME.test(startTime)) {
      throwUserError("FIELD_REQUIRED", "Pick a start time.");
    }
    const row = await ctx.db
      .query("protectedHours")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .unique();
    const fields = {
      days: [...days].sort((a, b) => a - b),
      startTime,
      calendarHold,
    };
    if (row) await ctx.db.patch(row._id, fields);
    else
      await ctx.db.insert("protectedHours", {
        careerProfileId: profile._id,
        ...fields,
      });
    return null;
  },
});
