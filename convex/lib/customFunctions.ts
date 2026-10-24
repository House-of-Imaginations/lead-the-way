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
import { requirePermissions } from "./orgs/membership";
import type { Permission } from "./orgs/permissions";
import { requireCareer, requireViewer } from "./viewer";
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
 * workspace the person isn't looking at. Consumed here: a handler never
 * redeclares it.
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

/**
 * Ruling 16: `viewerQuery` plus `hour`, for a query that reads `viewer.now`.
 * The client sends the current hour (`useHour`, or `currentHour()` on the
 * server), so a new hour is a new query and Convex reads the clock again.
 * The wrapper consumes `hour`, as `viewerMutation` consumes `expectOrgId`, so
 * a handler never redeclares it. `tests/convex/hour.test.ts` fails on a
 * query that reads `.now` without it.
 */
export const timedViewerQuery = (...need: Permission[]) =>
  customQuery(query, {
    args: { hour: v.optional(v.number()) },
    input: async (ctx: QueryCtx) => {
      assertAppOpen();
      return { ctx: { viewer: await requireViewer(ctx, need) }, args: {} };
    },
  });

/**
 * The Change careers builders: `ctx.career` is the caller's career profile,
 * of any kind (R6: P12b decides per function whether a guide may call it).
 * X2: they never touch the team builders above, and no team builder reads a
 * career table. `careerQuery` consumes `hour` as `timedViewerQuery` does,
 * since `career.now` reads the clock. Throws NOT_SIGNED_IN, then
 * NO_CAREER_TRACK.
 */
export const careerQuery = customQuery(query, {
  args: { hour: v.optional(v.number()) },
  input: async (ctx: QueryCtx) => {
    assertAppOpen();
    return { ctx: { career: await requireCareer(ctx) }, args: {} };
  },
});

export const careerMutation = customMutation(mutation, {
  args: {},
  input: async (ctx: MutationCtx) => {
    assertAppOpen();
    return { ctx: { career: await requireCareer(ctx) }, args: {} };
  },
});
