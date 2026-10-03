import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  type ActionCtx,
} from "./_generated/server";
import { assertFlag } from "./app";
import { createAuth } from "./auth";
import { DEMO_SLUG, writeCalderLane as write } from "./lib/demo/calderLane";
import { nowFor } from "./lib/clock";
import { ACCOUNT_HOLDERS, castOf, demoUserId } from "./lib/demo/cast";
import { moveClock } from "./lib/demo/moveClock";
import { demoTargetValidator } from "./lib/demo/schedule";
import { INVITE_MESSAGE } from "./lib/demo/script";
import { throwUserError } from "./lib/errors";
import { insertInvite, inviteRoleOf } from "./lib/orgs/invites";
import { currentSprint } from "./lib/sprint";

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

/** `npx convex run seed:reset`: the accounts, then a fresh Calder Lane. */
export const reset = internalAction({
  args: {},
  returns: v.id("orgs"),
  handler: async (ctx): Promise<Id<"orgs">> => {
    const accounts = await ensureDemoAccounts(ctx);
    return await ctx.runMutation(internal.seed.writeCalderLane, { accounts });
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

/**
 * `pnpm exec convex run seed:invite '{"email":"x@example.com"}'`: a Calder
 * Lane invitation from Priya, and its token, for e2e. `status` makes a
 * finished link, so the join page's refusals can be shown.
 * ponytail: e2e has no other way to hold a token. Demo addresses can't sign
 * up, and the demo holds no open links. Demo only, like `clock`.
 */
export const invite = internalMutation({
  args: {
    email: v.optional(v.string()),
    status: v.optional(literals("revoked", "declined", "accepted")),
  },
  returns: v.string(),
  handler: async (ctx, { email, status }) => {
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
    const sprint = await currentSprint(ctx, org._id);
    const role = await inviteRoleOf(ctx, org._id);
    const { inviteId, token } = await insertInvite(ctx, {
      orgId: org._id,
      roleId: role._id,
      email,
      sprintId: sprint?._id,
      message: sprint?.inviteMessage ?? INVITE_MESSAGE,
      invitedBy: priya.userId,
      at: nowFor(org),
    });
    if (status) await ctx.db.patch(inviteId, { status });
    return token;
  },
});
