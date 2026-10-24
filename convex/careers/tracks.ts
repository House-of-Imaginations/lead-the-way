import { v } from "convex/values";
import { authComponent } from "../auth";
import { insertCareerProfile, logCareerEvent } from "../lib/careers/writers";
import { authenticatedMutation, careerMutation } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { EMAIL, normalEmail } from "../lib/inviteRules";
import { seatsOfUser } from "../lib/orgs/membership";
import { firstNameOf } from "../lib/orgs/people";
import { getViewer } from "../lib/viewer";
import { takeDraft } from "./drafts";

const domainOf = (email: string) => normalEmail(email).split("@").pop() ?? "";

/**
 * MS3: a team account starts a private Change careers track (D3, X3), with
 * the Pivot Map draft if it has one. The contact address is refused when it
 * is the login address, or on the domain of the open workspace or of any
 * seat the account holds. It is stored only on the career profile, never on
 * `people` or the Better Auth user, and no career path mails it.
 */
export const startPrivate = authenticatedMutation({
  args: { contactEmail: v.string(), draftToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { contactEmail, draftToken }) => {
    const email = normalEmail(contactEmail);
    if (!EMAIL.test(email)) {
      throwUserError(
        "CONTACT_EMAIL_INVALID",
        "Enter an email address, like name@example.com.",
      );
    }
    const user = await authComponent.getAnyUserById(ctx, ctx.userId);
    if (email === normalEmail(user?.email ?? "")) {
      throwUserError(
        "CONTACT_EMAIL_INVALID",
        "Use a personal address, not the one you log in with.",
      );
    }
    const viewer = await getViewer(ctx);
    const seats = await seatsOfUser(ctx, ctx.userId);
    const work = [
      normalEmail(viewer?.org.domain ?? ""),
      ...seats.map((p) => domainOf(p.email)),
    ];
    if (work.includes(domainOf(email))) {
      throwUserError(
        "CONTACT_EMAIL_INVALID",
        "Use a personal address, not one on your workplace's domain.",
      );
    }
    const map = await takeDraft(ctx, draftToken);
    await insertCareerProfile(ctx, {
      userId: ctx.userId,
      firstName: firstNameOf(user?.name ?? ""),
      private: true,
      contactEmail: email,
      ...map,
    });
    // ponytail: wall clock; there is no career clock before the profile exists.
    await logCareerEvent(ctx, { name: "privateTrackStarted", at: Date.now() });
    return null;
  },
});

/** Every table keyed by `careerProfileId` that `deleteCareer` empties (spec 5.4). */
const OWNED = [
  "careerSettings",
  "crewMembers",
  "protectedHours",
  "lessonProgress",
  "careerProjects",
  "presentations",
  "confidence",
  "proofLinks",
] as const;

/**
 * MS4, X6 and P8: deletes the learner's career track in one mutation. The
 * badges and endorsements stay, keyed by `userId`. A guide profile is not a
 * track, so a guide is refused.
 */
export const deleteCareer = careerMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") {
      throwUserError("NO_CAREER_TRACK", "Start a Change careers track first.");
    }
    for (const table of OWNED) {
      // ponytail: each table has the same `by_careerProfile` index, so one
      // name stands in for the union the query builder can't type.
      const rows = await ctx.db
        .query(table as "careerSettings")
        .withIndex("by_careerProfile", (q) =>
          q.eq("careerProfileId", profile._id),
        )
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    const choices = await ctx.db
      .query("ruleChoices")
      .withIndex("by_careerProfile_and_rule", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .collect();
    for (const row of choices) await ctx.db.delete(row._id);
    await ctx.db.delete(profile._id);
    await logCareerEvent(ctx, { name: "trackDeleted", at: ctx.career.now });
    return null;
  },
});
