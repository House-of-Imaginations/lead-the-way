import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
import {
  ALL_PERMISSIONS,
  type Permission,
  grants,
  within,
} from "./permissions";

/**
 * Every read and every write of a `people` row, in one file.
 *
 * THE REASON IT IS A CHOKEPOINT. The invariant this product cannot survive
 * losing is "somebody can still administer this org". That is not a property of
 * a role document -- a role saying `kind: "owner"` guarantees the capability
 * EXISTS, never that anybody holds it. It is a property of the member
 * population, so it has to be re-checked by every path that writes or deletes a
 * `people` row: changing somebody's role, removing them, leaving and accepting
 * an invite. One of them forgetting is an org nobody can ever administer again.
 *
 * So no Convex function patches or deletes a `people` row directly. They
 * come through here: a helper that owns one table's writes, whose callers did
 * their own authorization first.
 */

/** A seat and what it can do: the answer the gate needs, in one value. */
export type Seat = {
  person: Doc<"people">;
  role: Doc<"orgRoles">;
  permissions: readonly Permission[];
};

/**
 * What a role document grants.
 *
 * The owner role's answer is computed, not stored -- see `ALL_PERMISSIONS` in
 * `./permissions` for why storing it would need a migration every time the
 * vocabulary grows.
 */
export function permissionsOf(role: Doc<"orgRoles">): readonly Permission[] {
  return role.kind === "owner" ? ALL_PERMISSIONS : role.permissions;
}

/**
 * The seat this person holds in this org, or null.
 *
 * `.unique()` rather than `.first()` deliberately: two rows for one person in
 * one org is a bug somewhere upstream, and the loud failure is much better than
 * silently honouring whichever row happens to sort first, which could be the
 * weaker of the two or the stronger.
 */
export async function findSeat(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: Id<"orgs">,
): Promise<Seat | null> {
  const person = await ctx.db
    .query("people")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", userId).eq("orgId", orgId),
    )
    .unique();
  if (!person) return null;

  const role = await ctx.db.get(person.roleId);
  // Fails closed. A seat pointing at a role that is gone is a broken row, and
  // a broken row must not read as unrestricted.
  if (!role || role.orgId !== orgId) return null;

  return { person, role, permissions: permissionsOf(role) };
}

/**
 * The seat, or a refusal. Says nothing about whether the org exists: somebody
 * probing ids learns only that they are not in it.
 */
export async function seatOf(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: Id<"orgs">,
): Promise<Seat> {
  const seat = await findSeat(ctx, userId, orgId);
  if (!seat) {
    throwUserError("NOT_A_MEMBER", "You are not a member of this workspace.");
  }
  return seat;
}

/** Refuse unless this seat holds every permission named. */
export function requirePermissions(
  seat: Seat,
  need: readonly Permission[],
): void {
  if (!grants(seat.permissions, need)) {
    throwUserError(
      "FORBIDDEN",
      "Your role in this workspace does not allow that.",
    );
  }
}

/**
 * Refuse to hand out more than you hold.
 *
 * Called on every write that could widen somebody's reach: creating or editing
 * a role, assigning one, and inviting into one. Without it `roles:manage` is
 * indistinguishable from owner, because its holder could simply edit their own
 * role to include everything.
 */
export function requireWithin(
  granting: readonly Permission[],
  caller: Seat,
): void {
  if (!within(granting, caller.permissions)) {
    throwUserError(
      "PERMISSION_ESCALATION",
      "You cannot grant a permission you do not have yourself.",
    );
  }
}

/**
 * Refuse to act on anything that reaches further than you do.
 *
 * The twin of `requireWithin`: that one stops you handing out more than you
 * hold, this one stops you TAKING from somebody who holds more. Both are
 * needed, and the second is the easier of the two to forget -- an admin with
 * `members:manage` evicting an owner is the same escalation as granting
 * yourself `org:manage`, wearing a different hat.
 */
export function requireReach(
  caller: Seat,
  target: readonly Permission[],
): void {
  if (!within(target, caller.permissions)) {
    throwUserError(
      "PERMISSION_ESCALATION",
      "That reaches further than your own role does.",
    );
  }
}

/** `requireReach` against a person. The common case, named for it. */
export function requireOutranks(caller: Seat, target: Seat): void {
  if (!within(target.permissions, caller.permissions)) {
    throwUserError(
      "PERMISSION_ESCALATION",
      "You cannot change somebody whose role reaches further than yours.",
    );
  }
}

/** The org's owner role. Exactly one exists, created with the org. */
export async function ownerRoleOf(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"orgs">,
): Promise<Doc<"orgRoles">> {
  const roles = await ctx.db
    .query("orgRoles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();

  const owner = roles.find((role) => role.kind === "owner");
  if (!owner) {
    // Unreachable through any mutation here, so it is a broken deployment
    // rather than something a person did. Loud, not silently permissive.
    throw new Error(`org ${orgId} has no owner role`);
  }
  return owner;
}

/**
 * Would this org still have an owner afterwards?
 *
 * THE COUNT IS READ HERE, INSIDE THE TRANSACTION, and that is the whole of why
 * this is safe against two admins demoting each other at once. The `by_role`
 * range is in the transaction's read set, so the second transaction conflicts
 * with the first's write, re-runs, sees one owner left and refuses. Pass a
 * count in from a prior query or an argument and that protection is gone.
 *
 * `.take(2)` because the question is "more than one", never "how many".
 */
export async function assertOwnerSurvives(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  losingId: Id<"people">,
): Promise<void> {
  const ownerRole = await ownerRoleOf(ctx, orgId);

  const owners = await ctx.db
    .query("people")
    .withIndex("by_role", (q) => q.eq("roleId", ownerRole._id))
    .take(2);

  const remaining = owners.filter((row) => row._id !== losingId);
  if (remaining.length === 0) {
    throwUserError(
      "LAST_OWNER",
      "This workspace would be left with no owner. Make somebody else an owner first.",
    );
  }
}

/** Move a seat to another role, having checked the org keeps an owner. */
export async function setRole(
  ctx: MutationCtx,
  person: Doc<"people">,
  roleId: Id<"orgRoles">,
): Promise<void> {
  if (person.roleId === roleId) return;
  await assertOwnerSurvives(ctx, person.orgId, person._id);
  await ctx.db.patch(person._id, { roleId });
}

/** Give up a seat, having checked the org keeps an owner. */
export async function dropSeat(
  ctx: MutationCtx,
  person: Doc<"people">,
): Promise<void> {
  await assertOwnerSurvives(ctx, person.orgId, person._id);
  await ctx.db.delete(person._id);
}

/** Every org this person sits in. Bounded, like every list read here. */
export const MAX_ORGS_PER_USER = 50;

/**
 * The most people one workspace can hold.
 *
 * THIS IS AN ENFORCED CEILING, NOT A PAGE SIZE, and the difference matters:
 * `members.list` reads with `.take(MAX_MEMBERS_PER_ORG)` and `deleteOrg`
 * `.collect()`s the whole table range in one transaction (fine to about 4k
 * rows, per the ponytail note there). If joining could exceed this, the first
 * would silently hide people and the second would grow into a transaction that
 * cannot commit -- with the workspace's deletion as the thing that fails. So the check lives at the only door in.
 */
export const MAX_MEMBERS_PER_ORG = 200;

/**
 * Refuse a seat that would take this person past the per-account ceiling.
 *
 * BOTH DOORS INTO A WORKSPACE CALL THIS -- creating one and accepting an
 * invitation. `seatsOfUser` reads `.take(MAX_ORGS_PER_USER)`, so a seat past
 * the ceiling would never show.
 *
 * The read is bounded and its range lands in the transaction's read set, so two
 * simultaneous joins at the ceiling conflict and the second re-runs against the
 * committed count rather than both squeezing in.
 */
export async function assertCanCreate(
  ctx: MutationCtx,
  userId: string,
): Promise<void> {
  const seats = await ctx.db
    .query("people")
    .withIndex("by_user_and_org", (q) => q.eq("userId", userId))
    .take(MAX_ORGS_PER_USER);
  if (seats.length >= MAX_ORGS_PER_USER) {
    throwUserError(
      "FIELD_REQUIRED",
      `You can be in at most ${MAX_ORGS_PER_USER} workspaces. Leave one first.`,
    );
  }
}

/** The account ceiling above, plus the workspace's own. */
export async function assertCanJoin(
  ctx: MutationCtx,
  userId: string,
  orgId: Id<"orgs">,
): Promise<void> {
  await assertCanCreate(ctx, userId);

  const members = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(MAX_MEMBERS_PER_ORG);
  if (members.length >= MAX_MEMBERS_PER_ORG) {
    throwUserError(
      "FIELD_REQUIRED",
      `This workspace is full at ${MAX_MEMBERS_PER_ORG} members.`,
    );
  }
}

export async function seatsOfUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"people">[]> {
  // The compound index serves this prefix, which is why there is no `by_user`.
  return await ctx.db
    .query("people")
    .withIndex("by_user_and_org", (q) => q.eq("userId", userId))
    .take(MAX_ORGS_PER_USER);
}
