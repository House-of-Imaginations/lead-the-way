import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MAX_MEMBERS_PER_ORG } from "./orgs/membership";

/**
 * THE ONLY WAY A MANAGER SEES A NUMBER ABOUT PEOPLE (spec 5.1).
 *
 * Every manager-facing query builds its numbers here: keep only the people
 * `loadCountable` returns, then `aggregate` or `count`. Below the threshold the
 * answer carries no value at all, so a hidden number can't leak through a
 * return validator. The threshold is never below 5, whatever a workspace
 * stores, NaN included.
 */
export const MIN_THRESHOLD = 5;

export const thresholdOf = ({
  privacyThreshold: t,
}: Pick<Doc<"orgs">, "privacyThreshold">) =>
  Number.isFinite(t) ? Math.max(MIN_THRESHOLD, t) : MIN_THRESHOLD;

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

/**
 * The people a manager-facing number may count: the invited team, less anyone
 * who opted out of team totals (spec rule 5). Manager counts are over the
 * invited ("6 of 7 finished week 1"), so owner-kind seats never count. Nor
 * does the asker: they know their own value, so counting it toward their own
 * threshold would lower the floor by one. `askerId` is required so it cannot
 * be forgotten; an internal caller with nobody asking passes null.
 *
 * A seat whose role is gone is left out: counting it would only raise n.
 * Each opt-out is read by `by_person`, so no number of stale rows can push
 * one out of a window.
 */
export async function loadCountable(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  askerId: Id<"people"> | null,
): Promise<Doc<"people">[]> {
  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(MAX_MEMBERS_PER_ORG);
  const counted: Doc<"people">[] = [];
  for (const person of people) {
    if (person._id === askerId) continue;
    const role = await ctx.db.get(person.roleId);
    if (!role || role.orgId !== orgId || role.kind === "owner") continue;
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_person", (q) => q.eq("personId", person._id))
      .first();
    // No settings row means the default: counted.
    if (settings && !settings.includeInTeamTotals) continue;
    counted.push(person);
  }
  return counted;
}
