import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MAX_MEMBERS_PER_ORG } from "./orgs/membership";

/**
 * THE ONLY WAY A MANAGER SEES A NUMBER ABOUT PEOPLE (spec 5.1).
 *
 * Every manager-facing query builds its numbers here: keep only `countable`
 * people, then `aggregate` or `count`. Below the threshold the answer carries
 * no value at all, so a hidden number can't leak through a return validator.
 * The threshold is never below 5, whatever a workspace stores.
 */
export const MIN_THRESHOLD = 5;

export const thresholdOf = (org: Pick<Doc<"orgs">, "privacyThreshold">) =>
  Math.max(MIN_THRESHOLD, org.privacyThreshold);

export type Aggregate =
  { hidden: true; n: number } | { hidden: false; n: number; value: number };

export const aggregateValidator = v.union(
  v.object({ hidden: v.literal(true), n: v.number() }),
  v.object({ hidden: v.literal(false), n: v.number(), value: v.number() }),
);

/** The mean, to one decimal, or hidden when too few answered. */
export function aggregate(
  values: number[],
  org: Pick<Doc<"orgs">, "privacyThreshold">,
): Aggregate {
  const n = values.length;
  if (n < thresholdOf(org)) return { hidden: true, n };
  const mean = values.reduce((sum, x) => sum + x, 0) / n;
  return { hidden: false, n, value: Math.round(mean * 10) / 10 };
}

/** How many did something, out of `did.length`, or hidden when too few are counted. */
export function count(
  did: boolean[],
  org: Pick<Doc<"orgs">, "privacyThreshold">,
): Aggregate {
  const n = did.length;
  if (n < thresholdOf(org)) return { hidden: true, n };
  return { hidden: false, n, value: did.filter(Boolean).length };
}

/** People who have not opted out of team totals. No settings row means counted. */
export function countable(
  people: Doc<"people">[],
  settings: Doc<"settings">[],
): Doc<"people">[] {
  const out = new Set(
    settings.filter((s) => !s.includeInTeamTotals).map((s) => s.personId),
  );
  return people.filter((person) => !out.has(person._id));
}

/**
 * Every person in the workspace who has not opted out, the manager's own row
 * included: spec rule 5 excludes only opted-out people, so this does not
 * filter by role. Callers aggregate the rows they read (survey answers,
 * progress), and a manager has none of those, so n never counts them.
 */
export async function loadCountable(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<Doc<"people">[]> {
  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(MAX_MEMBERS_PER_ORG);
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(MAX_MEMBERS_PER_ORG);
  return countable(people, settings);
}
