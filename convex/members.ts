import { v } from "convex/values";
import { orgMutation, orgQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
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

const memberValidator = v.object({
  personId: v.id("people"),
  userId: v.string(),
  name: v.string(),
  email: v.string(),
  roleId: v.id("orgRoles"),
  roleName: v.string(),
  isOwner: v.boolean(),
  joinedAt: v.number(),
});

/** Name, email and role only (privacy rule 7). Never participation data. */
export const list = orgQuery("members:read")({
  args: {},
  returns: v.array(memberValidator),
  handler: async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(MAX_MEMBERS_PER_ORG);

    const members = [];
    for (const person of people) {
      const role = await ctx.db.get(person.roleId);
      if (!role) continue;
      members.push({
        personId: person._id,
        userId: person.userId,
        name: person.name,
        email: person.email,
        roleId: person.roleId,
        roleName: role.name,
        isOwner: role.kind === "owner",
        joinedAt: person.createdAt,
      });
    }
    return members;
  },
});

/** Move somebody to another role. */
export const changeRole = orgMutation("members:manage")({
  args: { personId: v.id("people"), roleId: v.id("orgRoles") },
  returns: v.null(),
  handler: async (ctx, { personId, roleId }): Promise<null> => {
    const person = await ctx.db.get(personId);
    if (!person || person.orgId !== ctx.orgId) {
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
    // somebody already past you.
    requireWithin(permissionsOf(role), ctx);
    requireOutranks(ctx, await seatOf(ctx, person.userId, ctx.orgId));

    await setRole(ctx, person, roleId);
    return null;
  },
});

/** Take somebody's seat away. */
export const remove = orgMutation("members:manage")({
  args: { personId: v.id("people") },
  returns: v.null(),
  handler: async (ctx, { personId }): Promise<null> => {
    const person = await ctx.db.get(personId);
    if (!person || person.orgId !== ctx.orgId) {
      throwUserError(
        "NOT_FOUND",
        "That person is no longer in this workspace.",
      );
    }
    requireOutranks(ctx, await seatOf(ctx, person.userId, ctx.orgId));

    await dropSeat(ctx, person);
    return null;
  },
});

/** Show yourself out. The last owner is refused and has to hand over first. */
export const leave = orgMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await dropSeat(ctx, ctx.person);
    return null;
  },
});
