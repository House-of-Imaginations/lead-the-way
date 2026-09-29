import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { assertFlag } from "./app";
import { createAuth } from "./auth";
import { ACCOUNT_HOLDERS, demoUserId } from "./lib/demo/cast";

/**
 * Seeding the Calder Lane demo. `npx convex run seed:reset` does all of it
 * (Task 8); `seed:accounts` is the first half on its own.
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
