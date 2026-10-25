import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { learnerOf, settingsFor } from "../lib/careers/crew";
import { logCareerEvent } from "../lib/careers/writers";
import { careerMutation, careerQuery } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { hours, targetRole } from "../tables/careers";

/**
 * D8 Privacy and settings, the learner's own `careerSettings` row. MS4's
 * career column edits the same fields (spec 11.5), through `privacy.setCareer`.
 */

const CAREER_KEYS = [
  "showDoneToCrew",
  "guideSeesProgress",
  "reflectionOnProof",
  "researchOptIn",
  "learningHour",
  "crewCheckIn",
  "missedWeekNudge",
  "sundaySummary",
  "listenInstead",
] as const;
type CareerKey = (typeof CAREER_KEYS)[number];

const settingsValidator = v.object(
  Object.fromEntries(CAREER_KEYS.map((k) => [k, v.boolean()])) as Record<
    CareerKey,
    ReturnType<typeof v.boolean>
  >,
);

export const mine = careerQuery({
  args: {},
  returns: v.object({
    settings: settingsValidator,
    // D8 Profile: a private track's contact address (X3), shown only to its owner.
    private: v.boolean(),
    contactEmail: v.union(v.null(), v.string()),
    answers: v.object({
      currentRole: v.union(v.null(), v.string()),
      targetRole: v.union(v.null(), targetRole),
      hoursPerWeek: v.union(v.null(), hours),
    }),
  }),
  handler: async (ctx) => {
    const profile = learnerOf(ctx.career);
    const row = await settingsFor(ctx, profile._id);
    if (!row) throwUserError("NOT_FOUND", "That no longer exists.");
    return {
      settings: Object.fromEntries(CAREER_KEYS.map((k) => [k, row[k]])) as {
        [K in CareerKey]: boolean;
      },
      private: profile.private,
      contactEmail: profile.contactEmail ?? null,
      answers: {
        currentRole: profile.currentRole ?? null,
        targetRole: profile.targetRole ?? null,
        hoursPerWeek: profile.hoursPerWeek ?? null,
      },
    };
  },
});

/** One switch, saved at once. */
export const set = careerMutation({
  args: { key: literals(...CAREER_KEYS), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { key, on }) => {
    const row = await settingsFor(ctx, learnerOf(ctx.career)._id);
    if (!row) throwUserError("NOT_FOUND", "That no longer exists.");
    await ctx.db.patch(row._id, { [key]: on });
    return null;
  },
});

/**
 * P8 Delete my answers: clears the Tell us answers and consent, and the
 * draft the cookie still names. Badges, projects and endorsements stay. The
 * event has no person in it (P10).
 */
export const deleteAnswers = careerMutation({
  args: { draftToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { draftToken }) => {
    const profile = learnerOf(ctx.career);
    await ctx.db.patch(profile._id, {
      currentRole: undefined,
      targetRole: undefined,
      hoursPerWeek: undefined,
      consentAt: undefined,
    });
    if (draftToken) {
      const draft = await ctx.db
        .query("mapDrafts")
        .withIndex("by_token", (q) => q.eq("token", draftToken))
        .unique();
      if (draft) await ctx.db.delete(draft._id);
    }
    await logCareerEvent(ctx, { name: "answersDeleted", at: ctx.career.now });
    return null;
  },
});
