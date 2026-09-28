import { PERMISSIONS, type Permission } from "@convex/lib/orgs/permissions";

/**
 * What each permission is called on screen.
 *
 * The vocabulary itself is backend code -- `convex/lib/orgs/permissions.ts` is
 * the one place it may grow, because every entry has to correspond to a real
 * gate. This is only the wording, and it lives here because a `Record` keyed on
 * the exported union means adding a permission without naming it is a type
 * error rather than a screen that shows somebody `things:write`.
 */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "org:manage": "Manage the workspace",
  "members:read": "See members",
  "members:manage": "Invite and remove people",
  "roles:manage": "Create and edit roles",
};

/** One sentence under each checkbox: what holding it lets somebody do. */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "org:manage": "Rename the workspace and change its picture.",
  "members:read": "See who is in the workspace and what roles exist.",
  "members:manage": "Send and revoke invitations, change roles, remove people.",
  "roles:manage": "Create, edit and delete roles like this one.",
};

/** In vocabulary order, so the chips do not reshuffle between roles. */
export const PERMISSION_ORDER: readonly Permission[] = PERMISSIONS;
