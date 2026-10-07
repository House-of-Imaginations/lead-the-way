import { v } from "convex/values";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import {
  MAX_MEMBERS_PER_ORG,
  dropSeat,
  isOwnerRole,
  permissionsOf,
  requireAnyOf,
  requireOutranks,
  requireOwner,
  requireWithin,
  seatOf,
  setRole,
} from "./lib/orgs/membership";
import { grants, within } from "./lib/orgs/permissions";

/**
 * Who is in a workspace, and the writes that change that.
 *
 * Every mutation goes through `convex/lib/orgs/membership.ts` rather than
 * touching a `people` row itself, because "this workspace still has an owner"
 * has to be re-checked by every path that could break it.
 *
 * Two escalation guards apply to every write:
 *  - `requireWithin`: you may not grant a role stronger than your own.
 *  - `requireOutranks`: you may not act on somebody stronger than you.
 */

// M-b: a custom role holding every permission passes requireWithin and
// requireOutranks, so without this it could take the owner role.
const OWNER_ROLE = "Only an owner can give or take away the owner role.";

// `orgId` on every Members row: 18 shows only its own workspace's (C2).
const memberValidator = v.object({
  orgId: v.id("orgs"),
  personId: v.id("people"),
  userId: v.string(),
  name: v.string(),
  email: v.string(),
  roleId: v.id("orgRoles"),
  roleName: v.string(),
  isOwner: v.boolean(),
  joinedAt: v.number(),
  you: v.boolean(),
  /** This seat may change or remove them (requireOutranks, M-b). */
  canManage: v.boolean(),
});

/**
 * Name, email and role only (privacy rule 7). Never participation data. The
 * Members tab reads it with `members:manage` (W-g); `members:read` stays in
 * code and reads it too (M-e). `you` lets the tab leave your own row alone.
 */
export const list = viewerQuery()({
  args: {},
  returns: v.array(memberValidator),
  handler: async (ctx) => {
    requireAnyOf(ctx.viewer, ["members:read", "members:manage"]);
    const orgId = ctx.viewer.org._id;
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(MAX_MEMBERS_PER_ORG);

    // The same checks changeRole and remove run, so the menu never offers
    // what the server refuses.
    const manages = grants(ctx.viewer.permissions, ["members:manage"]);
    const owner = isOwnerRole(ctx.viewer.role);
    const members = [];
    for (const person of people) {
      const role = await ctx.db.get(person.roleId);
      if (!role) continue;
      const you = person._id === ctx.viewer.person._id;
      members.push({
        orgId,
        personId: person._id,
        userId: person.userId,
        name: person.name,
        email: person.email,
        roleId: person.roleId,
        roleName: role.name,
        isOwner: isOwnerRole(role),
        joinedAt: person.createdAt,
        you,
        canManage:
          manages &&
          !you &&
          within(permissionsOf(role), ctx.viewer.permissions) &&
          (!isOwnerRole(role) || owner),
      });
    }
    return members;
  },
});

/** Move somebody to another role. */
export const changeRole = viewerMutation("members:manage")({
  args: { personId: v.id("people"), roleId: v.id("orgRoles") },
  returns: v.null(),
  handler: async (ctx, { personId, roleId }): Promise<null> => {
    const orgId = ctx.viewer.org._id;
    const person = await ctx.db.get(personId);
    if (!person || person.orgId !== orgId) {
      throwUserError(
        "NOT_FOUND",
        "That person is no longer in this workspace.",
      );
    }
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throwUserError("NOT_FOUND", "That role no longer exists.");
    }
    // You may not promote somebody past yourself, and you may not act on
    // somebody already past you. Escalation is checked first, so its message
    // is the one a non-owner sees for a reach they never had.
    const target = await seatOf(ctx, person.userId, orgId);
    requireWithin(permissionsOf(role), ctx.viewer);
    requireOutranks(ctx.viewer, target);
    if (isOwnerRole(role) || isOwnerRole(target.role)) {
      requireOwner(ctx.viewer, OWNER_ROLE);
    }

    await setRole(ctx, person, roleId);
    return null;
  },
});

/** Take somebody's seat away. */
export const remove = viewerMutation("members:manage")({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }): Promise<null> => {
    const orgId = ctx.viewer.org._id;
    const person = await ctx.db.get(personId);
    if (!person || person.orgId !== orgId) {
      throwUserError(
        "NOT_FOUND",
        "That person is no longer in this workspace.",
      );
    }
    const target = await seatOf(ctx, person.userId, orgId);
    requireOutranks(ctx.viewer, target);
    if (isOwnerRole(target.role)) requireOwner(ctx.viewer, OWNER_ROLE);

    await dropSeat(ctx, person);
    return null;
  },
});

/**
 * Show yourself out. The last owner is refused and has to hand over first.
 *
 * P7b R-h, accepted: a credential you shared stays public after you leave, under
 * the name stored on it at issue (M-c), and nothing in the product takes it
 * down. Spec 5.1 says so.
 */
export const leave = viewerMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await dropSeat(ctx, ctx.viewer.person);
    return null;
  },
});
