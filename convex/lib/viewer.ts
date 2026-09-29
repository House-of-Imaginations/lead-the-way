import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { profileOf } from "./account/profile";
import { requireUserId } from "./auth/identity";
import { nowFor } from "./clock";
import { throwUserError } from "./errors";
import {
  permissionsOf,
  requirePermissions,
  seatsOfUser,
  type Seat,
} from "./orgs/membership";
import type { Permission } from "./orgs/permissions";

/**
 * WHO IS ASKING, AND IN WHICH WORKSPACE. The identity entry point for product
 * functions (AGENTS.md). The org layer's builders (`orgQuery`, `orgMutation`
 * and the `authenticated*` ones) still use `requireUserId`.
 *
 * Must not import `convex/auth.ts`: `customFunctions.ts` imports this file,
 * and `auth.ts` imports `customFunctions.ts`.
 */
export type Viewer = Seat & { userId: string; org: Doc<"orgs">; now: number };

/**
 * The signed-in account's workspace: the one it last opened, or else any seat
 * that still resolves. Null for a signed-in account with no usable seat, which
 * is a normal state (signed up, not yet set up or invited), not an error.
 *
 * Spec 4.2's `{person, workspace, permissions}`: the workspace is `org`, plus
 * `role` and `userId`. `now` is the workspace's clock (`nowFor`): stamp what
 * the viewer does with it, never with `Date.now()`.
 */
export async function getViewer(
  ctx: QueryCtx | MutationCtx,
): Promise<Viewer | null> {
  const userId = await requireUserId(ctx);
  const profile = await profileOf(ctx, userId);
  const people = await seatsOfUser(ctx, userId);
  const ordered = [
    ...people.filter((p) => p.orgId === profile?.activeOrgId),
    ...people.filter((p) => p.orgId !== profile?.activeOrgId),
  ];
  for (const person of ordered) {
    const org = await ctx.db.get(person.orgId);
    const role = await ctx.db.get(person.roleId);
    // A seat whose workspace or role is gone is skipped, never trusted.
    if (!org || !role || role.orgId !== org._id) continue;
    return {
      person,
      role,
      permissions: permissionsOf(role),
      userId,
      org,
      now: nowFor(org),
    };
  }
  return null;
}

/** The viewer, holding every permission in `need`. */
export async function requireViewer(
  ctx: QueryCtx | MutationCtx,
  need: Permission[],
): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) {
    throwUserError("NO_WORKSPACE", "Set up or join a workspace first.");
  }
  requirePermissions(viewer, need);
  return viewer;
}
