import { v } from "convex/values";
import { authComponent } from "./auth";
import { orgMutation, orgQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { profileOf } from "./lib/account/profile";
import {
  MAX_MEMBERS_PER_ORG,
  dropSeat,
  permissionsOf,
  requireOutranks,
  requireWithin,
  seatOf,
  setRole,
} from "./lib/orgs/membership";

/**
 * Who is in a workspace, and the two writes that change that.
 *
 * Every mutation here goes through `convex/lib/orgs/membership.ts` rather than
 * touching a `memberships` row itself. That file is the only writer of the
 * table, because the invariant "this workspace still has an owner" has to be
 * re-checked by every path that could break it, and six scattered copies of
 * that check is five chances to omit one.
 *
 * Two escalation guards apply to every write:
 *  - `requireWithin`  -- you may not grant a role stronger than your own.
 *  - `requireOutranks` -- you may not act on somebody stronger than you.
 * Between them, `members:manage` cannot be used to seize a workspace.
 */

const memberValidator = v.object({
  membershipId: v.id("memberships"),
  userId: v.string(),
  displayName: v.string(),
  roleId: v.id("orgRoles"),
  roleName: v.string(),
  isOwner: v.boolean(),
  joinedAt: v.number(),
});

/**
 * The member list.
 *
 * The display name comes from `profiles`, which is the product's record of a
 * person. Somebody who has not filled one in yet is shown by the address they
 * signed up with, read from the auth component -- "Someone" told you nothing,
 * and a list of three anonymous rows is not a list of people. The placeholder
 * survives only for a row whose auth user is gone: a member with no profile is
 * still in the workspace, and a list that hides people is worse than one with
 * a placeholder in it.
 *
 * The address is read ONLY when there is no display name, so the common case
 * is the same reads it always was. Everyone here already holds `members:read`
 * for this workspace, which is the same audience the invitation list shows
 * pinned addresses to.
 */
export const list = orgQuery("members:read")({
  args: {},
  returns: v.array(memberValidator),
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(MAX_MEMBERS_PER_ORG);

    const members = [];
    for (const membership of memberships) {
      const role = await ctx.db.get(membership.roleId);
      if (!role) continue;
      const profile = await profileOf(ctx, membership.userId);
      const displayName =
        profile?.displayName ??
        (await authComponent.getAnyUserById(ctx, membership.userId))?.email ??
        "Someone";

      members.push({
        membershipId: membership._id,
        userId: membership.userId,
        displayName,
        roleId: membership.roleId,
        roleName: role.name,
        isOwner: role.kind === "owner",
        joinedAt: membership.createdAt,
      });
    }
    return members;
  },
});

/** Move somebody to another role. */
export const changeRole = orgMutation("members:manage")({
  args: { membershipId: v.id("memberships"), roleId: v.id("orgRoles") },
  returns: v.null(),
  handler: async (ctx, { membershipId, roleId }): Promise<null> => {
    const membership = await ctx.db.get(membershipId);
    if (!membership || membership.orgId !== ctx.orgId) {
      throwUserError(
        "NOT_FOUND",
        "That person is no longer in this workspace.",
      );
    }

    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== ctx.orgId) {
      throwUserError("NOT_FOUND", "That role no longer exists.");
    }

    // You may not promote somebody past yourself, and you may not act on
    // somebody already past you. The owner role is only ever assignable by an
    // owner, which falls out of the first check rather than being special-cased.
    requireWithin(permissionsOf(role), ctx);
    requireOutranks(ctx, await seatOf(ctx, membership.userId, ctx.orgId));

    await setRole(ctx, membership, roleId);
    return null;
  },
});

/** Take somebody's seat away. */
export const remove = orgMutation("members:manage")({
  args: { membershipId: v.id("memberships") },
  returns: v.null(),
  handler: async (ctx, { membershipId }): Promise<null> => {
    const membership = await ctx.db.get(membershipId);
    if (!membership || membership.orgId !== ctx.orgId) {
      throwUserError(
        "NOT_FOUND",
        "That person is no longer in this workspace.",
      );
    }
    requireOutranks(ctx, await seatOf(ctx, membership.userId, ctx.orgId));

    await dropSeat(ctx, membership);
    return null;
  },
});

/**
 * Show yourself out.
 *
 * No permission required -- leaving is not an administrative act. The owner
 * check still applies, so the last owner is refused and has to hand the
 * workspace over or delete it.
 */
export const leave = orgMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await dropSeat(ctx, ctx.membership);
    return null;
  },
});
