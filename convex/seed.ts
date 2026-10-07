import { literals } from "convex-helpers/validators";
import type { GenericDocument, PaginationResult } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { assertFlag } from "./app";
import { createAuth } from "./auth";
import { profileOf } from "./lib/account/profile";
import { DEMO_SLUG, writeCalderLane as write } from "./lib/demo/calderLane";
import { nowFor } from "./lib/clock";
import { ACCOUNT_HOLDERS, castOf, demoUserId } from "./lib/demo/cast";
import { moveClock } from "./lib/demo/moveClock";
import { demoTargetValidator } from "./lib/demo/schedule";
import { INVITE_MESSAGE } from "./lib/demo/script";
import { throwUserError } from "./lib/errors";
import { deleteOrg } from "./lib/orgs/cascade";
import { insertInvite, inviteRoleOf } from "./lib/orgs/invites";
import { isOwnerRole, permissionsOf, rolesOf } from "./lib/orgs/membership";
import { isManager, type Permission } from "./lib/orgs/permissions";
import { setupSprint } from "./lib/sprint";

/**
 * Seeding the Calder Lane demo. `npx convex run seed:reset` does all of it;
 * `seed:accounts` is the first half on its own.
 */

const MIN_PASSWORD = 12;

/**
 * Find or create the eight demo accounts, through Better Auth's own sign-up.
 *
 * ponytail: an existing account keeps the password it was made with. Changing
 * DEMO_PASSWORD later doesn't update it; delete the demo users in the
 * dashboard and reseed if you need to.
 */
async function ensureDemoAccounts(
  ctx: ActionCtx,
): Promise<Record<string, string>> {
  assertFlag("demo", true);
  const password = process.env.DEMO_PASSWORD ?? "";
  if (password.length < MIN_PASSWORD) {
    throw new Error(
      `Set DEMO_PASSWORD to at least ${MIN_PASSWORD} characters: npx convex env set DEMO_PASSWORD <password>`,
    );
  }
  const ids: Record<string, string> = {};
  const missing: (typeof ACCOUNT_HOLDERS)[number][] = [];
  for (const person of ACCOUNT_HOLDERS) {
    const existing = await demoUserId(ctx, person.email);
    if (existing) ids[person.key] = existing;
    else missing.push(person);
  }
  // Built only when something needs signing up, so a reseed of an intact
  // demo never constructs the auth instance.
  if (missing.length > 0) {
    const auth = createAuth(ctx, { seed: true });
    for (const person of missing) {
      const { user } = await auth.api.signUpEmail({
        body: { name: person.name, email: person.email, password },
      });
      ids[person.key] = user.id;
    }
  }
  return ids;
}

export const accounts = internalAction({
  args: {},
  returns: v.record(v.string(), v.string()),
  handler: ensureDemoAccounts,
});

export const writeCalderLane = internalMutation({
  args: { accounts: v.record(v.string(), v.string()) },
  returns: v.id("orgs"),
  handler: (ctx, { accounts }) => write(ctx, accounts),
});

/** e2e signs its accounts up on this domain, so a reset can find them (Ruling 34). */
export const E2E_DOMAIN = "e2e.test";

/** Delete every `model` row the auth component holds for `userId`. */
async function deleteAuthRows(
  ctx: MutationCtx,
  model: "session" | "account",
  userId: string,
) {
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    ({ isDone, continueCursor: cursor } = await ctx.runMutation(
      components.betterAuth.adapter.deleteMany,
      {
        input: { model, where: [{ field: "userId", value: userId }] },
        paginationOpts: { numItems: 100, cursor },
      },
    ));
  }
}

/**
 * Ruling 34: the accounts e2e signed up on `E2E_DOMAIN`, the workspaces they
 * own, their profiles and their sign-in rows. Returns how many accounts went.
 * `reset` runs it first. Demo only, like `invite`.
 * ponytail: one transaction, fine for the few dozen accounts a run makes;
 * schedule batches if it ever hits the transaction limits.
 */
export const clearE2e = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    assertFlag("demo", true);
    // `ends_with` has no index, so the adapter filters as it scans and a page
    // can come back short. Only `isDone` says the scan is over.
    const userIds: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const result: PaginationResult<GenericDocument> = await ctx.runQuery(
        components.betterAuth.adapter.findMany,
        {
          model: "user",
          where: [
            { field: "email", operator: "ends_with", value: `@${E2E_DOMAIN}` },
          ],
          paginationOpts: { numItems: 100, cursor },
        },
      );
      userIds.push(...result.page.map((user) => String(user._id)));
      ({ isDone, continueCursor: cursor } = result);
    }

    for (const userId of userIds) {
      // At most MAX_ORGS_PER_USER seats. Calder Lane is never theirs to own,
      // and the reset rebuilds it after this.
      const seats = await ctx.db
        .query("people")
        .withIndex("by_user_and_org", (q) => q.eq("userId", userId))
        .collect();
      for (const seat of seats) {
        const role = await ctx.db.get(seat.roleId);
        const org = await ctx.db.get(seat.orgId);
        if (role && isOwnerRole(role) && org && !org.isDemo) {
          await deleteOrg(ctx, org._id);
        }
      }
      const profile = await profileOf(ctx, userId);
      if (profile) await ctx.db.delete(profile._id);
      // The user last: its session and account rows would outlive it.
      await deleteAuthRows(ctx, "session", userId);
      await deleteAuthRows(ctx, "account", userId);
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: "user", where: [{ field: "_id", value: userId }] },
      });
    }
    return userIds.length;
  },
});

/**
 * `npx convex run seed:reset`: the e2e accounts cleared (Ruling 34), the
 * accounts, then a fresh Calder Lane.
 */
export const reset = internalAction({
  args: {},
  returns: v.id("orgs"),
  handler: async (ctx): Promise<Id<"orgs">> => {
    const cleared = await ctx.runMutation(internal.seed.clearE2e, {});
    console.log(`Cleared ${cleared} e2e accounts.`);
    const accounts = await ensureDemoAccounts(ctx);
    const orgId = await ctx.runMutation(internal.seed.writeCalderLane, {
      accounts,
    });
    // Calder Lane's badges come from issueBadge; other workspaces' may be older.
    await ctx.runMutation(internal.badges.backfillHolders, {});
    return orgId;
  },
});

/**
 * `pnpm exec convex run seed:clock '{"target":"week2"}'`: move the demo clock
 * without signing in. For e2e and local runs; the guide uses `demo.setClock`.
 */
export const clock = internalMutation({
  args: { target: demoTargetValidator },
  returns: v.object({ demoNow: v.number(), applied: v.array(v.string()) }),
  handler: async (ctx, { target }) => {
    assertFlag("demo", true);
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG))
      .unique();
    if (!org?.isDemo) {
      throwUserError(
        "DEMO_NOT_SEEDED",
        "Seed the demo first: pnpm exec convex run seed:reset.",
      );
    }
    return await moveClock(ctx, org, target);
  },
});

/** A custom role by name, made once, for e2e seats that test a permission alone. */
async function customRole(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  name: string,
  permissions: Permission[],
  at: number,
): Promise<Id<"orgRoles">> {
  const roles = await rolesOf(ctx, orgId);
  const found = roles.find((r) => r.kind === "custom" && r.name === name);
  if (found) return found._id;
  return await ctx.db.insert("orgRoles", {
    orgId,
    kind: "custom",
    name,
    permissions,
    createdAt: at,
  });
}

/**
 * `pnpm exec convex run seed:invite '{"email":"x@example.com"}'`: a Calder
 * Lane invitation from Priya, and its token, for e2e. `status` makes a
 * finished link, so the join page's refusals can be shown.
 * ponytail: e2e has no other way to hold a token. Demo addresses can't sign
 * up, and the demo holds no open links. Demo only, like `clock`.
 * `insights` grants the Team lead role (`team:insights` only) instead of Employee.
 * `members` grants the People admin role (`members:manage` only) instead.
 * `org` grants the Workspace admin role (`org:manage` only) instead.
 * `roles` grants the Role admin role (`roles:manage` only) instead.
 */
export const invite = internalMutation({
  args: {
    email: v.optional(v.string()),
    status: v.optional(literals("revoked", "declined", "accepted")),
    insights: v.optional(v.boolean()),
    members: v.optional(v.boolean()),
    org: v.optional(v.boolean()),
    roles: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: async (
    ctx,
    { email, status, insights, members, org: orgAdmin, roles: roleAdmin },
  ) => {
    assertFlag("demo", true);
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG))
      .unique();
    if (!org?.isDemo) {
      throwUserError(
        "DEMO_NOT_SEEDED",
        "Seed the demo first: pnpm exec convex run seed:reset.",
      );
    }
    // At most nine people in the demo.
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(20);
    const priya = people.find((p) => p.email === castOf("priya").email);
    if (!priya) {
      throwUserError(
        "DEMO_NOT_SEEDED",
        "Seed the demo first: pnpm exec convex run seed:reset.",
      );
    }
    const sprint = await setupSprint(ctx, org._id);
    const at = nowFor(org);
    const roleId = insights
      ? await customRole(ctx, org._id, "Team lead", ["team:insights"], at)
      : members
        ? await customRole(ctx, org._id, "People admin", ["members:manage"], at)
        : orgAdmin
          ? await customRole(
              ctx,
              org._id,
              "Workspace admin",
              ["org:manage"],
              at,
            )
          : roleAdmin
            ? await customRole(ctx, org._id, "Role admin", ["roles:manage"], at)
            : (await inviteRoleOf(ctx, org._id))._id;
    // As Invite member (M-g): only a team member's invitation pins the sprint.
    const role = (await ctx.db.get(roleId))!;
    const manager = isManager({ permissions: permissionsOf(role) });
    const { inviteId, token } = await insertInvite(ctx, {
      orgId: org._id,
      roleId,
      email,
      sprintId: manager ? undefined : sprint?._id,
      message: sprint?.inviteMessage ?? INVITE_MESSAGE,
      invitedBy: priya.userId,
      at,
    });
    if (status) await ctx.db.patch(inviteId, { status });
    return token;
  },
});
