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
