import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { MAX_MEMBERS_PER_ORG, permissionsOf } from "./orgs/membership";
import { isManager, type Permission } from "./orgs/permissions";
import { settingsOf } from "./settings";

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
 *
 * LIVE OR FROZEN (Rulings 1 to 3). Totals of private activity that a manager
 * sees come from the weekly `teamSnapshots` rows (lib/snapshots.ts), never
 * from a live `count` or `aggregate` inside a query: two live looks a minute
 * apart could be differenced back to the one person who acted. Membership
 * counts (invited, joined) are live, as they are facts about the invitation,
 * not activity. A snapshot's totals are checked again when read (`statOf` in
 * manager.ts), against the threshold now and the one the row stored (P7a
 * Ruling 7). The files that may call `count` and `aggregate` are pinned by a
 * test in tests/convex/canary.test.ts; extend that list on purpose, never in
 * passing.
 *
 * WHO A ROW COUNTED (Ruling FX). Each snapshot stores the ids it counted and
 * the ids seated when it was taken, only so `snapshotSeries`
 * (lib/snapshots.ts) can show just the rows whose counted and seated groups
 * both equal the sprint's first row's, and hide a row from a reader it
 * counted. No query returns them.
 *
 * LIVE "JOINED" BESIDE A FROZEN "OF N" (P7a Ruling 8). 08 shows the live
 * joined count next to a snapshot's n. The gap says how many people a total
 * leaves out (opted out, or managing the team), never who. Accepted.
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
 * invited ("6 of 7 finished week 1"), so nobody who manages the team counts
 * (`loadSeated`, Ruling 1): not an owner-kind seat (the owner holds every
 * permission), not a custom role with `team:insights` or `sprint:manage`.
 * Nor does the asker: they know their own value, so counting it toward their
 * own threshold would lower the floor by one. `askerId` is required so it
 * cannot be forgotten; an internal caller with nobody asking passes null.
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
  const counted: Doc<"people">[] = [];
  for (const person of await loadSeated(ctx, org)) {
    if (person._id === askerId) continue;
    // No settings row means the default: counted.
    if (!(await settingsOf(ctx, person._id)).includeInTeamTotals) continue;
    counted.push(person);
  }
  // The brand is type-only; this is the one place a Countable is made.
  return counted as unknown as Countable;
}

/**
 * Everyone seated on the team: each person in the org whose role is the
 * org's and who doesn't manage the team, opted out or not, whoever is asking.
 * Ruling 1: a role with `team:insights` or `sprint:manage` is a manager's, and
 * a manager is in no total. Their pre-launch `normsConfidence` shares its key
 * with the team's week 4 answer, and they know their own value, so counting
 * them would lower the floor. Not a `Countable`; `signatureCount` and
 * `countSeated` are the sanctioned counts made from it (Rulings 1 and 24).
 * The agreement's "Signed by the team" reads it, so the title is the same for
 * every viewer and no opt-out flips it.
 */
export async function loadSeated(
  ctx: QueryCtx,
  org: Doc<"orgs">,
): Promise<Doc<"people">[]> {
  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", org._id))
    .take(MAX_MEMBERS_PER_ORG);
  const seated: Doc<"people">[] = [];
  for (const person of people) {
    const role = await ctx.db.get(person.roleId);
    if (!role || role.orgId !== org._id) continue;
    if (isManager({ permissions: permissionsOf(role) })) continue;
    seated.push(person);
  }
  return seated;
}

/**
 * The one count over the seated team (`loadSeated`), for public acts such as
 * presenting (R-i): opting out of team totals doesn't hide what a person
 * showed the team. Hidden below the threshold, as `count` is. It counts
 * whatever list it is handed, so the caller must pass `loadSeated`'s result,
 * never a filtered few; the seated canary in tests/convex/canary.test.ts
 * pins which files may call it.
 */
export function countSeated(
  seated: readonly Doc<"people">[],
  did: (person: Doc<"people">) => boolean,
  org: Pick<Doc<"orgs">, "privacyThreshold">,
): Aggregate {
  const n = seated.length;
  if (n < thresholdOf(org)) return { hidden: true, n };
  return { hidden: false, n, value: seated.filter(did).length };
}

/**
 * 10's signature count: who signed `agreement`, over the seated team as the
 * overview counts it (`loadSeated`). Null below the threshold, as the
 * overview's "Signed by the team" is (manager Ruling 15), so a count can't
 * single out who hasn't signed. Null too for anyone who manages the team
 * (`team:insights` or `sprint:manage`): a manager reads the overview, which
 * never lets a live number out (manager Ruling 15), so the rule lives here and
 * no caller can forget it.
 *
 * ponytail: runs in every employee's `me.home` and `forMe`, reading N people,
 * N roles and S signatures, and re-runs for every seated employee on each
 * signature or `people` write: about 80k reads per signature at
 * MAX_MEMBERS_PER_ORG (200). Denormalize a count on the agreement past that.
 */
export async function signatureCount(
  ctx: QueryCtx,
  org: Doc<"orgs">,
  agreement: Pick<Doc<"agreements">, "_id" | "version">,
  permissions: readonly Permission[],
): Promise<{ signed: number; of: number } | null> {
  if (isManager({ permissions })) return null;
  const seated = await loadSeated(ctx, org);
  if (seated.length < thresholdOf(org)) return null;
  const signatures = await ctx.db
    .query("agreementSignatures")
    .withIndex("by_agreement_version_and_person", (q) =>
      q.eq("agreementId", agreement._id).eq("version", agreement.version),
    )
    .take(MAX_MEMBERS_PER_ORG);
  const signedBy = new Set(signatures.map((s) => s.personId));
  return {
    signed: seated.filter((p) => signedBy.has(p._id)).length,
    of: seated.length,
  };
}
