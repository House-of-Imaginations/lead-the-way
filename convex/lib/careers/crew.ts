import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
import type { Career } from "../viewer";
import { lessonsFor, type CredentialId } from "./catalog";

/**
 * Reads the P12b demo day, proof, guide and settings functions share. Each
 * takes the caller's own profile; nothing here takes an id from a client.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

/** The crew's week, from 1, by its `startsOn` date. */
export function crewWeek(crew: Doc<"crews">, now: number): number {
  // ponytail: UTC midnight of `startsOn`; use the crew's zone if a week edge ever matters.
  return Math.max(
    1,
    Math.floor((now - Date.parse(crew.startsOn)) / WEEK_MS) + 1,
  );
}

/**
 * P2: one word for this week. `done` when the week's lessons are all done,
 * `back` when a lesson was finished in the last 7 days, else `notYet`. No
 * count, streak or missed week leaves this function.
 */
export function weeklyOf(
  crew: Doc<"crews">,
  progress: Doc<"lessonProgress">[],
  now: number,
): Weekly {
  const done = new Set(progress.map((p) => p.lessonId));
  const due = lessonsFor(crew.credentialId).filter(
    (l) => l.week === crewWeek(crew, now),
  );
  if (due.length > 0 && due.every((l) => done.has(l.id))) return "done";
  if (progress.some((p) => p.completedAt > now - WEEK_MS)) return "back";
  return "notYet";
}
