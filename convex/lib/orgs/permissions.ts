import { literals } from "convex-helpers/validators";
import type { Infer } from "convex/values";

/**
 * What an organization's roles are built out of.
 *
 * THE DIVISION THIS FILE EXISTS TO STATE: an org invents ROLES, never
 * PERMISSIONS. A role is a name and a set, chosen per org and stored as a row.
 * A permission is one of these, fixed in code, because every one of them has to
 * correspond to a gate somewhere in `convex/` -- a permission nothing checks is
 * a checkbox that lies to whoever ticks it.
 *
 * Adding one is a deploy, not a migration: a role's array simply does not
 * contain the new name, which is exactly "not granted". The owner role is the
 * one that needs no migration either, and `ALL_PERMISSIONS` below is why.
 *
 * `area:verb`, always. The prefix is what lets a screen ask "may this person
 * see the members tab at all" without enumerating verbs.
 */
export const PERMISSIONS = [
  "org:manage", // rename and delete the org
  "members:read",
  "members:manage", // invite, remove, change somebody's role
  "roles:manage", // create, edit and delete roles
  "sprint:manage", // set up the team, the hour and the agreement; launch and run the sprint
  "team:insights", // read team aggregates (overview, outcomes); never one person's numbers
] as const;

export const permissionValidator = literals(...PERMISSIONS);

export type Permission = Infer<typeof permissionValidator>;

/**
 * What the owner role resolves to, computed rather than stored.
 *
 * The owner role deliberately carries NO permissions array -- see the union in
 * `convex/tables/orgs.ts`. If it stored one, the day somebody adds a permission
 * to the list above would be the day every existing org's owner quietly lacked
 * it, and the owner role is un-editable by rule, so the org would be stuck
 * until a migration walked every row. Resolving it from the code constant means
 * a new permission reaches every owner in every org the moment it deploys.
 */
export const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

/** The longest role name `orgRoles` accepts; the role editor's field stops there too. */
export const MAX_ROLE_NAME = 40;

/** Does this permission set contain every one of `need`? */
export function grants(
  held: readonly Permission[],
  need: readonly Permission[],
): boolean {
  return need.every((permission) => held.includes(permission));
}

/**
 * Is `inner` within `outer`? The check that stops privilege escalation.
 *
 * WITHOUT THIS, `roles:manage` IS OWNER. Somebody holding it could edit their
 * own role to add every permission in the list, and somebody holding
 * `members:manage` could move themselves to a role stronger than their own.
 * Custom roles would collapse into two real tiers -- "can edit roles" and
 * "cannot" -- and the whole vocabulary above would be decoration.
 *
 * So every write that could widen somebody's reach is refused unless the
 * caller already holds what it would grant. You may hand out what you have.
 */
export function within(
  inner: readonly Permission[],
  outer: readonly Permission[],
): boolean {
  return grants(outer, inner);
}

/**
 * W-f: holding any of these is controlling the workspace, and whoever
 * controls it manages the team: left out of team totals, in the manager area.
 */
export const WORKSPACE_PERMISSIONS = [
  "org:manage",
  "members:manage",
  "roles:manage",
] as const satisfies readonly Permission[];

/**
 * Which side of the manager line each permission puts its holder (W-f).
 * Every permission is classed, so a new one can't join the list unclassed
 * (tests/convex/workspace/permissions.test.ts). `members:read` alone unlocks
 * nothing (M-e), so it is a teammate's.
 */
export const PERMISSION_CLASS = {
  "org:manage": "manager",
  "members:read": "teammate",
  "members:manage": "manager",
  "roles:manage": "manager",
  "sprint:manage": "manager",
  "team:insights": "manager",
} as const satisfies Record<Permission, "manager" | "teammate">;

const MANAGER_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (p) => PERMISSION_CLASS[p] === "manager",
);

/**
 * M-i: what the role editor calls each permission. `members:read` has a
 * label so the record is complete, but the editor never shows it
 * (`HIDDEN_PERMISSIONS`).
 */
export const PERMISSION_LABELS = {
  "org:manage": "Change workspace settings",
  "members:read": "See who is in the workspace",
  "members:manage": "Invite and remove people",
  "roles:manage": "Create and edit roles",
  "sprint:manage": "Set up and run the sprint",
  "team:insights": "See team totals",
} as const satisfies Record<Permission, string>;

/** M-e: kept in code, never offered in the role editor, kept on save. */
export const HIDDEN_PERMISSIONS: readonly Permission[] = ["members:read"];

/** The role editor's checkboxes, in this order. */
export const ROLE_EDITOR_PERMISSIONS: readonly Permission[] =
  PERMISSIONS.filter((p) => !HIDDEN_PERMISSIONS.includes(p));

/**
 * The manager area is a matter of permissions, never of a role's name (rule 6).
 * `members:read` alone is not on the list (M-e): it unlocks nothing.
 */
export const isManager = ({
  permissions,
}: {
  permissions: readonly Permission[];
}) => MANAGER_PERMISSIONS.some((p) => permissions.includes(p));

/**
 * The permission each manager page's query needs, or null for any manager
 * (Ruling 5). The nav shows a link only to a holder and 08's `canManage`
 * reads it, so the nav, the overview's buttons and the query can't disagree.
 * tests/convex/routes.test.ts fails when a page's query needs another.
 */
export const ROUTE_PERMISSION = {
  "/manager": null,
  "/manager/sprint/launch": "sprint:manage",
  "/manager/agreement": "sprint:manage",
  "/manager/outcomes": "team:insights",
  "/manager/learning": "sprint:manage",
} as const satisfies Record<string, Permission | null>;

export type ManagerRoute = keyof typeof ROUTE_PERMISSION;
