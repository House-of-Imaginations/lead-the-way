import { v } from "convex/values";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { pickInviteRole } from "./lib/orgs/invites";
import {
  MAX_MEMBERS_PER_ORG,
  MAX_ROLES_PER_ORG,
  isOwnerRole,
  permissionsOf,
  requireAnyOf,
  requireReach,
  requireWithin,
  rolesOf,
} from "./lib/orgs/membership";
import {
  grants,
  isManager,
  permissionValidator,
  within,
} from "./lib/orgs/permissions";

/**
 * The roles an organization invented for itself.
 *
 * The rule that shapes every mutation here is in `lib/orgs/permissions.ts`:
 * you may hand out only what you hold. Without it `roles:manage` is owner in
 * everything but name, because its holder could edit their own role to include
 * the rest of the vocabulary.
 *
 * The owner role is not editable and not deletable from here at all. It has no
 * stored permission array to edit -- see `convex/tables/orgs.ts`.
 */

const MAX_ROLE_NAME = 40;

// `orgId` on every row: 18 shows only its own workspace's (C2). The flags are
// the mutations' own checks, so Members and Roles never offer a refusal.
const roleValidator = v.object({
  orgId: v.id("orgs"),
  _id: v.id("orgRoles"),
  name: v.string(),
  isOwner: v.boolean(),
  permissions: v.array(permissionValidator),
  /** How many people hold it. A count, never who. */
  holders: v.number(),
  /** Launch and Invite member put the team into it (`pickInviteRole`). */
  launch: v.boolean(),
  /** Holding it makes a manager (W-f), for R-b's confirm. */
  makesManager: v.boolean(),
  /** This seat may move somebody into it (Change role, Invite member). */
  assignable: v.boolean(),
  /** This seat may rename it and change its permissions (R-a). */
  editable: v.boolean(),
  /** ...and delete it: nobody holds it and the team isn't invited into it. */
  deletable: v.boolean(),
});

/** The roles, for Members' role choices (W-g) and the Roles tab. */
export const list = viewerQuery()({
  args: {},
  returns: v.array(roleValidator),
  handler: async (ctx) => {
    const { viewer } = ctx;
    requireAnyOf(viewer, ["members:read", "members:manage", "roles:manage"]);
    const roles = await rolesOf(ctx, viewer.org._id);
    const launchId = pickInviteRole(roles)?._id;
    const assigns = grants(viewer.permissions, ["members:manage"]);
    const edits = grants(viewer.permissions, ["roles:manage"]);
    const owner = isOwnerRole(viewer.role);
    const rows = [];
    for (const role of roles) {
      const permissions = permissionsOf(role);
      const reach = within(permissions, viewer.permissions);
      const holders = (
        await ctx.db
          .query("people")
          .withIndex("by_role", (q) => q.eq("roleId", role._id))
          .take(MAX_MEMBERS_PER_ORG)
      ).length;
      const editable =
        edits && reach && !isOwnerRole(role) && role._id !== viewer.role._id;
      rows.push({
        orgId: role.orgId,
        _id: role._id,
        name: role.name,
        isOwner: isOwnerRole(role),
        permissions: [...permissions],
        holders,
        launch: role._id === launchId,
        makesManager: isManager({ permissions }),
        assignable: assigns && reach && (!isOwnerRole(role) || owner),
        editable,
        deletable: editable && holders === 0 && role._id !== launchId,
      });
    }
    return rows;
  },
});

function checkName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throwUserError("FIELD_REQUIRED", "A role needs a name.");
  if (trimmed.length > MAX_ROLE_NAME) {
    throwUserError(
      "FIELD_REQUIRED",
      `A role name can be at most ${MAX_ROLE_NAME} characters.`,
    );
  }
  return trimmed;
}

export const create = viewerMutation("roles:manage")({
  args: { name: v.string(), permissions: v.array(permissionValidator) },
  returns: v.id("orgRoles"),
  handler: async (ctx, { name, permissions }) => {
    const orgId = ctx.viewer.org._id;
    const trimmed = checkName(name);
    // The escalation guard. Refused before anything is written.
    requireWithin(permissions, ctx.viewer);

    const existing = await rolesOf(ctx, orgId);
    if (existing.length >= MAX_ROLES_PER_ORG) {
      throwUserError(
        "FIELD_REQUIRED",
        `A workspace can have at most ${MAX_ROLES_PER_ORG} roles.`,
      );
    }

    return await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: trimmed,
      // Deduplicated: a role holding the same permission twice is the same
      // role, and the array is compared as a set everywhere it is read.
      permissions: [...new Set(permissions)],
      createdAt: Date.now(),
    });
  },
});

export const update = viewerMutation("roles:manage")({
  args: {
    roleId: v.id("orgRoles"),
    name: v.string(),
    permissions: v.array(permissionValidator),
  },
  returns: v.null(),
  handler: async (ctx, { roleId, name, permissions }): Promise<null> => {
    const orgId = ctx.viewer.org._id;
    const role = await ctx.db.get(roleId);
    // Belongs to another org, or does not exist. Indistinguishable on purpose:
    // an id from a different tenant must not be confirmable by probing.
    if (!role || role.orgId !== orgId) {
      throwUserError("NOT_FOUND", "That role no longer exists.");
    }
    if (isOwnerRole(role)) {
      throwUserError(
        "FORBIDDEN",
        "The owner role always has every permission and cannot be edited.",
      );
    }

    // YOU MAY ONLY EDIT A ROLE THAT DOES NOT REACH FURTHER THAN YOURS, and
    // this is the guard the first version of this file was missing.
    //
    // Without it, "only the additions are checked" (below) has a hole big
    // enough to drive the whole model through: a member holding nothing but
    // `roles:manage` adds nothing, so the escalation check passes vacuously,
    // and they strip every permission off the role that carries `org:manage`
    // and `members:manage`. One call de-powers every administrator under the
    // owner. It is the same rule `members.ts` applies with `requireOutranks`
    // before touching a person -- and editing a role is exactly touching
    // everybody who holds it, one indirection further out.
    requireReach(ctx.viewer, permissionsOf(role));

    const trimmed = checkName(name);
    const next = [...new Set(permissions)];

    // Only what is BEING ADDED has to be within the caller's reach. Narrowing
    // a role you can already edit is not an escalation, so requiring the whole
    // set would stop an admin tidying up a role that outgrew them.
    const added = next.filter(
      (permission) => !role.permissions.includes(permission),
    );
    requireWithin(added, ctx.viewer);

    await ctx.db.patch(roleId, { name: trimmed, permissions: next });

    // Widening a role widens every invitation pinned to it, and those were
    // written for what the role was. Revoked rather than honoured. Revoked,
    // not deleted, so the link says it was withdrawn.
    if (added.length > 0) {
      const invites = await ctx.db
        .query("orgInvites")
        .withIndex("by_role", (q) => q.eq("roleId", roleId))
        .collect();
      for (const invite of invites) {
        if (invite.status === "pending") {
          await ctx.db.patch(invite._id, { status: "revoked" });
        }
      }
    }
    return null;
  },
});

export const remove = viewerMutation("roles:manage")({
  args: { roleId: v.id("orgRoles") },
  returns: v.null(),
  handler: async (ctx, { roleId }): Promise<null> => {
    const orgId = ctx.viewer.org._id;
    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== orgId) {
      throwUserError("NOT_FOUND", "That role no longer exists.");
    }
    if (isOwnerRole(role)) {
      throwUserError("FORBIDDEN", "The owner role cannot be deleted.");
    }
    // Same rule as `update`. Narrower consequences here, because the check
    // below refuses while anybody holds it -- but deleting a role somebody is
    // about to be given is still reaching past yourself.
    requireReach(ctx.viewer, permissionsOf(role));

    // Refused while somebody holds it, rather than cascading or reassigning.
    // A cascade evicts people from the workspace as a side effect of tidying
    // up roles; a reassignment silently changes what they can do, possibly
    // upward. Both are surprises. Refusing is the only one that is not.
    const holder = await ctx.db
      .query("people")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .first();
    if (holder) {
      throwUserError(
        "ROLE_IN_USE",
        "Somebody still has that role. Move them to another one first.",
      );
    }

    // An invitation is not a person, so taking it with the role is not a
    // surprise -- it is the only alternative to a link that grants a role
    // which no longer exists. Revoked, not deleted, so the link says it was
    // withdrawn.
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_role", (q) => q.eq("roleId", roleId))
      .collect();
    for (const invite of invites) {
      if (invite.status === "pending") {
        await ctx.db.patch(invite._id, { status: "revoked" });
      }
    }

    await ctx.db.delete(roleId);
    return null;
  },
});
