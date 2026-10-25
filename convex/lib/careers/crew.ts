import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
import type { Career } from "../viewer";
import { dayOf, weekOf } from "../sprintTime";
import type { CredentialId } from "./catalog";

/**
 * Reads the P12b demo day, proof, guide and settings functions share. Each
 * takes the caller's own profile; nothing here takes an id from a client.
 */

export type Weekly = "done" | "back" | "notYet";

/** The caller as a learner. A guide profile is not a track (R6). */
export function learnerOf(career: Career): Doc<"careerProfiles"> {
  if (career.profile.kind !== "learner") {
    throwUserError("NO_CAREER_TRACK", "Start a Change careers track first.");
  }
  return career.profile;
}

/** The caller as a Pathway Guide. */
export function guideOf(career: Career): Doc<"careerProfiles"> {
  if (career.profile.kind !== "guide") {
    throwUserError("FORBIDDEN", "Only a Pathway Guide can do that.");
  }
  return career.profile;
}

/** The crew a profile is in, as a member or as its guide. */
export async function crewOf(
  ctx: QueryCtx,
  profile: Doc<"careerProfiles">,
): Promise<Doc<"crews"> | null> {
  if (profile.kind === "guide") {
    return await ctx.db
      .query("crews")
      .withIndex("by_guide", (q) => q.eq("guideId", profile._id))
      .first();
  }
  const member = await ctx.db
    .query("crewMembers")
    .withIndex("by_careerProfile", (q) => q.eq("careerProfileId", profile._id))
    .first();
  return member && (await ctx.db.get(member.crewId));
}

/** A crew's members' profiles. A crew holds 5 or 6 (`capacity`). */
export async function membersOf(
  ctx: QueryCtx,
  crewId: Id<"crews">,
): Promise<Doc<"careerProfiles">[]> {
  const rows = await ctx.db
    .query("crewMembers")
    .withIndex("by_crew", (q) => q.eq("crewId", crewId))
    .take(50);
  const profiles = await Promise.all(
    rows.map((r) => ctx.db.get(r.careerProfileId)),
  );
  return profiles.filter((p) => p !== null);
}

export async function settingsFor(
  ctx: QueryCtx,
  careerProfileId: Id<"careerProfiles">,
): Promise<Doc<"careerSettings"> | null> {
  return await ctx.db
    .query("careerSettings")
    .withIndex("by_careerProfile", (q) =>
      q.eq("careerProfileId", careerProfileId),
    )
    .first();
}

/** The profile's project for a credential, or its first one. */
export async function projectFor(
  ctx: QueryCtx,
  careerProfileId: Id<"careerProfiles">,
  credentialId?: CredentialId,
): Promise<Doc<"careerProjects"> | null> {
  const rows = await ctx.db
    .query("careerProjects")
    .withIndex("by_careerProfile", (q) =>
      q.eq("careerProfileId", careerProfileId),
    )
    .take(10);
  return (
    rows.find((p) => !credentialId || p.credentialId === credentialId) ?? null
  );
}

/** The lesson ids a profile has finished. Bounded by the catalog's lessons. */
export async function doneLessons(
  ctx: QueryCtx,
  careerProfileId: Id<"careerProfiles">,
): Promise<Doc<"lessonProgress">[]> {
  return await ctx.db
    .query("lessonProgress")
    .withIndex("by_careerProfile", (q) =>
      q.eq("careerProfileId", careerProfileId),
    )
    .take(200);
}

const ZONE = "Australia/Melbourne";

/** The crew's week (1 is the week it starts) for any instant, in the crew's zone. */
export function crewWeek(crew: Doc<"crews">, at: number): number {
  // ponytail: one zone for every crew, the demo's; store it on the crew when another city joins.
  return weekOf(
    {
      startDate: crew.startsOn,
      timeZone: ZONE,
      protectedHour: {
        weekday: dayOf(crew.startsOn),
        start: crew.checkInTime,
        durationMinutes: 60,
      },
    },
    at,
  );
}

/**
 * P2, the one definition: a word for this week. `done` is any lesson
 * finished this week, `back` is that after a week with none, else `notYet`.
 * No count, streak or missed week leaves this function.
 */
export function weeklyOf(
  crew: Doc<"crews">,
  progress: Doc<"lessonProgress">[],
  now: number,
): Weekly {
  const week = crewWeek(crew, now);
  const weeks = new Set(progress.map((l) => crewWeek(crew, l.completedAt)));
  if (!weeks.has(week)) return "notYet";
  return week > 1 && !weeks.has(week - 1) ? "back" : "done";
}

/** Deletes a crew rule and every crewmate's choice on it. */
export async function deleteRule(
  ctx: MutationCtx,
  ruleId: Id<"crewRules">,
): Promise<void> {
  const choices = await ctx.db
    .query("ruleChoices")
    .withIndex("by_rule", (q) => q.eq("ruleId", ruleId))
    .take(100);
  for (const choice of choices) await ctx.db.delete(choice._id);
  await ctx.db.delete(ruleId);
}
