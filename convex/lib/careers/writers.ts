import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { throwUserError } from "../errors";

/** Counts only (P10, X5): a name, a time and the partner, never a person id. */
export type CareerEventName =
  | "mapBuilt"
  | "accountCreated"
  | "privateTrackStarted"
  | "trackDeleted"
  | "answersDeleted";

/** The only writer of `careerEvents`. `at` is the careers clock where one is in hand. */
export async function logCareerEvent(
  ctx: MutationCtx,
  e: { name: CareerEventName; at: number; partnerId?: Id<"careerPartners"> },
): Promise<void> {
  await ctx.db.insert("careerEvents", e);
}

type NewProfile = Omit<
  Doc<"careerProfiles">,
  "_id" | "_creationTime" | "kind" | "timezone" | "a11y"
>;

/**
 * The one way a learner profile is made (A6): one per account, never beside a
 * guide profile, always with its `careerSettings` defaults (D8).
 */
export async function insertCareerProfile(
  ctx: MutationCtx,
  fields: NewProfile,
): Promise<Id<"careerProfiles">> {
  const existing = await ctx.db
    .query("careerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", fields.userId))
    .first();
  if (existing) {
    throwUserError(
      "CAREER_TRACK_EXISTS",
      "You already have a Change careers track.",
    );
  }
  const careerProfileId = await ctx.db.insert("careerProfiles", {
    ...fields,
    kind: "learner",
    // ponytail: the demo's zone; take the browser's when a screen asks for it.
    timezone: "Australia/Melbourne",
    a11y: { captions: false, transcripts: false, audioFirst: false },
  });
  await ctx.db.insert("careerSettings", {
    careerProfileId,
    showDoneToCrew: true,
    guideSeesProgress: true,
    reflectionOnProof: true,
    researchOptIn: false,
    learningHour: true,
    crewCheckIn: true,
    missedWeekNudge: true,
    sundaySummary: false,
    listenInstead: false,
  });
  return careerProfileId;
}
