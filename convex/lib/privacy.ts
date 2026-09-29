import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MAX_MEMBERS_PER_ORG, permissionsOf } from "./orgs/membership";

/**
 * THE ONLY WAY A MANAGER SEES A NUMBER ABOUT PEOPLE (spec 5.1).
 *
 * Counts come only from a `Countable`, which only `loadCountable` builds, and
 * `aggregate` and `count` take one value per person, never a list of rows: so
 * n is always distinct people, and nobody can hand in a list that holds the
 * asker, a manager or an opted-out person. Events never feed a count of
 * private activity (sessions done, tasks underway, completed, presented):
 * read the person's own rows through `valueOf` or `did` instead. `valueOf`
 * answers with that person's own value or undefined, never as a filter that
 * narrows the team to a chosen few.
 *
 * Below the threshold the answer carries no value at all, so a hidden number
 * can't leak through a return validator. The threshold is never below 5,
 * whatever a workspace stores, NaN included.
 */
export const MIN_THRESHOLD = 5;

export const thresholdOf = ({
  privacyThreshold: t,
}: Pick<Doc<"orgs">, "privacyThreshold">) =>
  Number.isFinite(t) ? Math.max(MIN_THRESHOLD, t) : MIN_THRESHOLD;

declare const countable: unique symbol;
/** The people a manager-facing number may count. Only `loadCountable` makes one. */
export type Countable = readonly Doc<"people">[] & {
  readonly [countable]: true;
};

export type Aggregate =
  { hidden: true; n: number } | { hidden: false; n: number; value: number };

export const aggregateValidator = v.union(
  v.object({ hidden: v.literal(true), n: v.number() }),
  v.object({ hidden: v.literal(false), n: v.number(), value: v.number() }),
);

/**
 * The mean of each person's value, to one decimal, or hidden when too few
 * have one. `valueOf` answers undefined for somebody who didn't answer.
 */
export function aggregate(
  people: Countable,
  valueOf: (person: Doc<"people">) => number | undefined,
  org: Pick<Doc<"orgs">, "privacyThreshold">,
): Aggregate {
  const values = people.flatMap((p) => valueOf(p) ?? []);
  const n = values.length;
  if (n < thresholdOf(org)) return { hidden: true, n };
  const mean = values.reduce((sum, x) => sum + x, 0) / n;
  return { hidden: false, n, value: Math.round(mean * 10) / 10 };
}

/** How many did something, out of everyone counted, or hidden when too few are counted. */
export function count(
  people: Countable,
  did: (person: Doc<"people">) => boolean,
  org: Pick<Doc<"orgs">, "privacyThreshold">,
): Aggregate {
  const n = people.length;
  if (n < thresholdOf(org)) return { hidden: true, n };
  return { hidden: false, n, value: people.filter(did).length };
}

/**
 * The people a manager-facing number may count: the invited team, less anyone
 * who opted out of team totals (spec rule 5). Manager counts are over the
 * invited ("6 of 7 finished week 1"), so nobody who can read team totals
 * counts: not an owner-kind seat (the owner holds every permission), not a
 * custom role with `team:insights`. Nor does the asker: they know their own
 * value, so counting it toward their own threshold would lower the floor by
 * one. `askerId` is required so it cannot be forgotten; an internal caller
 * with nobody asking passes null.
 *
 * A seat whose role is gone is left out: counting it would only raise n.
 * Each opt-out is read by `by_person`, so no number of stale rows can push
 * one out of a window.
 */
export async function loadCountable(
  ctx: QueryCtx,
  org: Doc<"orgs">,
  askerId: Id<"people"> | null,
): Promise<Countable> {
  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", org._id))
    .take(MAX_MEMBERS_PER_ORG);
  const counted: Doc<"people">[] = [];
  for (const person of people) {
    if (person._id === askerId) continue;
    const role = await ctx.db.get(person.roleId);
    if (!role || role.orgId !== org._id) continue;
    if (permissionsOf(role).includes("team:insights")) continue;
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_person", (q) => q.eq("personId", person._id))
      .first();
    // No settings row means the default: counted.
    if (settings && !settings.includeInTeamTotals) continue;
    counted.push(person);
  }
  // The brand is type-only; this is the one place a Countable is made.
  return counted as unknown as Countable;
}
