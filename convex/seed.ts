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
import { ACCOUNT_HOLDERS, demoUserId } from "./lib/demo/cast";
import { moveClock } from "./lib/demo/moveClock";
import { demoTargetValidator } from "./lib/demo/schedule";
import { throwUserError } from "./lib/errors";

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
    const auth = createAuth(ctx);
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
