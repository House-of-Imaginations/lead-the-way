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
 * functions (AGENTS.md). The `authenticated*` builders, for functions with no
 * workspace yet, use `requireUserId`. Only the shared functions (`viewer.home`,
 * `viewer.shell`) call `getAccount` (spec 5.2).
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
      // A getter: a query that never asks the time never reads the wall clock.
      get now() {
        return nowFor(org);
      },
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

/** The signed-in account's Change careers profile, of any kind (R6). */
export type Career = {
  userId: string;
  profile: Doc<"careerProfiles">;
  readonly now: number;
};

/** The account's career profile, or null: no career track is a normal state. */
export async function getCareer(
  ctx: QueryCtx | MutationCtx,
): Promise<Career | null> {
  const userId = await requireUserId(ctx);
  const profile = await ctx.db
    .query("careerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return null;
  return {
    userId,
    profile,
    // ponytail: wall clock until P12a swaps in the careerDemo clock (spec 7).
    get now() {
      return Date.now();
    },
  };
}

export async function requireCareer(
  ctx: QueryCtx | MutationCtx,
): Promise<Career> {
  const career = await getCareer(ctx);
  if (!career) {
    throwUserError("NO_CAREER_TRACK", "Start a Change careers track first.");
  }
  return career;
}

/** The team viewer, with no permission asked. */
export async function requireTeam(
  ctx: QueryCtx | MutationCtx,
): Promise<Viewer> {
  return await requireViewer(ctx, []);
}

/** The account and each learner track it has. Keys are left out, never undefined. */
export type Account = {
  account: { userId: string; name: string };
  team?: Viewer;
  career?: Career;
};

export async function getAccount(
  ctx: QueryCtx | MutationCtx,
): Promise<Account> {
  const userId = await requireUserId(ctx);
  const [profile, team, career] = await Promise.all([
    profileOf(ctx, userId),
    getViewer(ctx),
    getCareer(ctx),
  ]);
  return {
    account: { userId, name: profile?.displayName ?? "" },
    ...(team && { team }),
    // R6: a guide profile is not a track.
    ...(career?.profile.kind === "learner" && { career }),
  };
}
