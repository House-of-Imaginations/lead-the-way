import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { v } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { action, mutation, query } from "../_generated/server";
import { requireUserId, safeUserId } from "./auth/identity";
import { throwUserError } from "./errors";
import { requirePermissions, seatOf } from "./orgs/membership";
import type { Permission } from "./orgs/permissions";
import { requireViewer } from "./viewer";
import { assertFlag } from "../app";

// Every public function refuses while the app is closed. See `convex/app.ts`.
const assertAppOpen = () => assertFlag("closed", false);

const optionalQueryIdentity = customCtx(async (ctx: QueryCtx) => {
  assertAppOpen();
  return { userId: await safeUserId(ctx) };
});
const requiredQueryIdentity = customCtx(async (ctx: QueryCtx) => {
  assertAppOpen();
  return { userId: await requireUserId(ctx) };
});
const optionalMutationIdentity = customCtx(async (ctx: MutationCtx) => {
  assertAppOpen();
  return { userId: await safeUserId(ctx) };
});
const requiredMutationIdentity = customCtx(async (ctx: MutationCtx) => {
  assertAppOpen();
  return { userId: await requireUserId(ctx) };
});
const optionalActionIdentity = customCtx(async (ctx: ActionCtx) => {
  assertAppOpen();
  return { userId: await safeUserId(ctx) };
});
const requiredActionIdentity = customCtx(async (ctx: ActionCtx) => {
  assertAppOpen();
  return { userId: await requireUserId(ctx) };
});

/** Public functions may inspect the current user while retaining guest access. */
export const publicQuery = customQuery(query, optionalQueryIdentity);
export const publicMutation = customMutation(
  mutation,
  optionalMutationIdentity,
);
export const publicAction = customAction(action, optionalActionIdentity);

/** Authenticated functions receive the server-derived Better Auth subject. */
export const authenticatedQuery = customQuery(query, requiredQueryIdentity);
export const authenticatedMutation = customMutation(
  mutation,
  requiredMutationIdentity,
);
export const authenticatedAction = customAction(action, requiredActionIdentity);

/**
 * The organization gate: a function scoped to one tenant, needing permissions.
 *
 * WHY THE PERMISSIONS ARE CLOSED OVER RATHER THAN PASSED IN. They are arguments
 * to the FACTORY, evaluated once at module scope, never arguments to the
 * function. `convex/lib/auth/identity.ts` states the rule: an argument is
 * something a client chooses, and a client choosing its own gate is not a gate.
 *
 * WHY THE WRAPPER CONSUMES `orgId`. It declares the argument, resolves it, and
 * returns `args: {}`, so the handler never sees it and there is no way to write
 * a scoped function that forgets to check. Declaring the check is the only way
 * to get at `ctx.orgId`, which is the shape that makes forgetting impossible
 * rather than merely discouraged. A handler must NOT redeclare `orgId` in its
 * own `args` -- convex-helpers refuses the duplicate.
 *
 * Two reads: one indexed seat lookup and one `ctx.db.get` of the role,
 * which is the cheapest read Convex has. Permissions are deliberately not
 * copied onto the `people` row -- that would save one read per call and cost
 * an unbounded fan-out on every role edit, during which some members would be
 * authorized against a stale set. A stale authorization that heals itself is a
 * defect nobody can reproduce afterwards.
 *
 * `ctx` gains `userId`, `orgId`, `person`, `role` and `permissions`, so a
 * handler that needs any of them does not read them a second time.
 *
 * FROZEN (P3). No new callers: product functions use `viewerQuery` and
 * `viewerMutation`. The callers left (orgs, members, orgRoles, invites and
 * `profiles.setActiveOrg`) move over in P7, and these two go.
 * `tests/convex/frozen.test.ts` fails when one is added.
 */
export const orgQuery = (...need: Permission[]) =>
  customQuery(query, {
    args: { orgId: v.id("orgs") },
    input: async (ctx: QueryCtx, { orgId }) => {
      assertAppOpen();
      const userId = await requireUserId(ctx);
      const seat = await seatOf(ctx, userId, orgId);
      requirePermissions(seat, need);
      return { ctx: { userId, orgId, ...seat }, args: {} };
    },
  });

export const orgMutation = (...need: Permission[]) =>
  customMutation(mutation, {
    args: { orgId: v.id("orgs") },
    input: async (ctx: MutationCtx, { orgId }) => {
      assertAppOpen();
      const userId = await requireUserId(ctx);
      const seat = await seatOf(ctx, userId, orgId);
      requirePermissions(seat, need);
      return { ctx: { userId, orgId, ...seat }, args: {} };
    },
  });

/**
 * Product functions: the viewer's own workspace, no `orgId` argument.
 *
 * `ctx.viewer` is the resolved seat, workspace and permissions. Scope every
 * read and write to `ctx.viewer.org._id`; a client never names the tenant.
 * Throws NOT_SIGNED_IN, then NO_WORKSPACE, then FORBIDDEN.
 */
export const viewerQuery = (...need: Permission[]) =>
  customQuery(query, {
    args: {},
    input: async (ctx: QueryCtx) => {
      assertAppOpen();
      return { ctx: { viewer: await requireViewer(ctx, need) }, args: {} };
    },
  });

/**
 * `expectOrgId` IS THE WORKSPACE THE PAGE WAS SHOWING (R6). The viewer's open
 * workspace lives on the profile, so a second tab can switch it under the
 * first. Every product mutation takes this echo (the client passes
 * `shell.expectOrgId`) and refuses with WORKSPACE_CHANGED rather than act on a
 * workspace the person isn't looking at. Consumed here, like `orgId` in
 * `orgMutation`: a handler never redeclares it.
 */
export const viewerMutation = (...need: Permission[]) =>
  customMutation(mutation, {
    args: { expectOrgId: v.id("orgs") },
    input: async (ctx: MutationCtx, { expectOrgId }) => {
      assertAppOpen();
      // Compare before checking permissions: a switched workspace may grant
      // fewer, and WORKSPACE_CHANGED is the answer that tells the person why.
      const viewer = await requireViewer(ctx, []);
      if (viewer.org._id !== expectOrgId) {
        throwUserError(
          "WORKSPACE_CHANGED",
          "You switched workspace in another tab. Reload the page to continue.",
        );
      }
      requirePermissions(viewer, need);
      return { ctx: { viewer }, args: {} };
    },
  });
