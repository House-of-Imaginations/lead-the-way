import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
import { ownerRoleOf, seatsOfUser } from "./membership";

/**
 * What happens to somebody's workspaces when they delete their account.
 *
 * THE DEFECT THIS EXISTS TO PREVENT, spelled out because it is permanent and
 * silent. `deleteAccount` used to tombstone the profile and stop. A membership
 * row keyed on a Better Auth subject has no referential integrity to that
 * profile, so a sole owner's seat outlived their account: for fourteen days
 * they were an owner refused every write, and after the purge their row stayed
 * behind forever, counting as a live owner in the survivor check. Nobody could
 * ever be promoted. The workspace was bricked, invisibly, with no repair path.
 *
 * `convex/account.ts` already wrote the rule this broke:
 *
 *   ANYTHING THIS PRODUCT ADDS THAT IS NOT THIS PERSON'S DATA ALONE -- a seat
 *   in a shared room, an item somebody else depends on -- is released HERE, at
 *   the tap, not at the purge.
 *
 * A seat is exactly that. So it goes at the tap, in the same transaction as the
 * tombstone, which also means a restore does NOT bring it back. The delete
 * screen says so, beside the sentence about push subscriptions.
 */

/**
 * Give up every seat, or refuse the deletion and say which workspace is in the
 * way.
 *
 * The refusal is deliberate, and the alternative was considered: promoting
 * somebody automatically. That hands a workspace to a person nobody chose, on
 * the strength of a row order. Better to stop and make the owner decide, which
 * is one throw and rolls the whole mutation back -- the tombstone included.
 */
/**
 * How many workspaces one account deletion may erase on its way out.
 *
 * `deleteOrg` is bounded per workspace, but `releaseSeats` calls it in a loop
 * inside the SINGLE transaction of `deleteAccount`. Somebody who solely owns
 * fifty workspaces at their ceilings is thousands of deletes in one mutation,
 * and a transaction that cannot commit fails the whole deletion permanently --
 * the tombstone rolls back with it, so the account is not half-deleted, it is
 * simply undeletable, forever, with no message that explains why.
 *
 * Refusing at a stated number is the honest version: it names the problem, and
 * the person clears it by deleting workspaces they already have a screen for.
 * Deliberately NOT a scheduled continuation like `purgeExpired`, because a seat
 * is shared state -- `convex/account.ts` says it goes at the tap, and half the
 * seats released now with the rest at some later tick is exactly the
 * half-deleted state the throw exists to avoid.
 */
const MAX_ORG_DELETES_PER_ACCOUNT = 5;

export async function releaseSeats(
  ctx: MutationCtx,
  userId: string,
): Promise<void> {
  const seats = await seatsOfUser(ctx, userId);
  let budget = MAX_ORG_DELETES_PER_ACCOUNT;

  for (const seat of seats) {
    const role = await ctx.db.get(seat.roleId);
    if (!role) {
      // A broken row. Take it with them rather than leaving it to count as
      // anything later.
      await ctx.db.delete(seat._id);
      continue;
    }

    if (role.kind !== "owner") {
      await ctx.db.delete(seat._id);
      continue;
    }

    const ownerRole = await ownerRoleOf(ctx, seat.orgId);
    const owners = await ctx.db
      .query("memberships")
      .withIndex("by_role", (q) => q.eq("roleId", ownerRole._id))
      .take(2);

    // Another owner carries on without them.
    if (owners.some((row) => row._id !== seat._id)) {
      await ctx.db.delete(seat._id);
      continue;
    }

    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", seat.orgId))
      .take(2);

    // Sole owner AND sole member: the workspace is theirs alone, so it is
    // their data and it goes with them at the tap.
    if (members.length <= 1) {
      if (budget <= 0) {
        throwUserError(
          "ORG_OWNERSHIP_HELD",
          `You own more than ${MAX_ORG_DELETES_PER_ACCOUNT} workspaces that nobody else is in. Delete some of them first.`,
        );
      }
      budget -= 1;
      await deleteOrg(ctx, seat.orgId);
      continue;
    }

    const org = await ctx.db.get(seat.orgId);
    throwUserError(
      "ORG_OWNERSHIP_HELD",
      `You are the only owner of ${org?.name ?? "a workspace"}. Make somebody else an owner, or delete the workspace, before deleting your account.`,
    );
  }
}

/**
 * Erase a workspace and everything filed under it.
 *
 * Bounded reads, but NOT bounded work: a workspace at the member ceiling is a
 * few hundred rows across three tables, which is well inside one transaction.
 * The ceilings in `members.ts`, `orgRoles.ts` and `invites.ts` are what make
 * that true, so raising any of them means revisiting this.
 */
export async function deleteOrg(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
): Promise<void> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of memberships) await ctx.db.delete(row._id);

  const invites = await ctx.db
    .query("orgInvites")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of invites) await ctx.db.delete(row._id);

  const roles = await ctx.db
    .query("orgRoles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of roles) await ctx.db.delete(row._id);

  // The picture last, and only after the row that points at it is read: an
  // orphaned file is a wasted megabyte, an orphaned pointer is a broken image
  // on every screen that draws the workspace.
  const org = await ctx.db.get(orgId);
  await ctx.db.delete(orgId);
  if (org?.imageId) await ctx.storage.delete(org.imageId);
}
