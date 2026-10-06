import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { slugify } from "./orgs/slug";

/** The course credential (spec 7.3): the only badge P6 issues. */
export const COURSE_BADGE = {
  name: "AI Fundamentals" as const,
  issuer: "IBM SkillsBuild" as const,
  skills: [
    "AI prompting",
    "Critical evaluation",
    "Responsible AI",
    "Workflow improvement",
  ],
};

/** A person's one badge, or null before they finish (Ruling 9). */
export async function badgeOf(ctx: QueryCtx, personId: Id<"people">) {
  return await ctx.db
    .query("badges")
    .withIndex("by_person", (q) => q.eq("personId", personId))
    .first();
}

async function slugTaken(ctx: MutationCtx, shareSlug: string) {
  return (
    (await ctx.db
      .query("badges")
      .withIndex("by_shareSlug", (q) => q.eq("shareSlug", shareSlug))
      .unique()) !== null
  );
}

/**
 * Ruling 9: the one writer of `badges`. A person keeps the badge they have.
 * Otherwise the slug is "<name>-ai-fundamentals", then "-2", "-3" and so on
 * until free. The `by_shareSlug` reads are in this transaction's read set, so
 * two people issued the same slug at once conflict and retry (roadmap 8a).
 */
export async function issueBadge(
  ctx: MutationCtx,
  person: Doc<"people">,
  at: number,
): Promise<Doc<"badges">> {
  const existing = await badgeOf(ctx, person._id);
  if (existing) return existing;
  const base = [slugify(person.name), "ai-fundamentals"]
    .filter(Boolean)
    .join("-");
  let shareSlug = base;
  for (let n = 2; await slugTaken(ctx, shareSlug); n++) {
    shareSlug = `${base}-${n}`;
  }
  const id = await ctx.db.insert("badges", {
    orgId: person.orgId,
    personId: person._id,
    name: COURSE_BADGE.name,
    issuer: COURSE_BADGE.issuer,
    completedAt: at,
    skills: COURSE_BADGE.skills,
    shareSlug,
    holderName: person.name,
    holderTimeZone: person.timeZone,
  });
  return (await ctx.db.get(id))!;
}
