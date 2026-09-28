import type { MutationCtx, QueryCtx } from "../../_generated/server";

/**
 * Who a notification is for, and what it says.
 *
 * Kept apart from `convex/push.ts` so the copy is a pure function the test
 * suite can assert on. A sentence typed inline into an action is a sentence no
 * test can reach.
 */
/**
 * How many devices one owner may be told on.
 *
 * Bounded because every read of an owner's subscriptions is on the delivery
 * path, and the house rule is that no read grows with a table. This is not a
 * limit anybody reaches by using the product normally -- it is a phone, a
 * laptop, maybe a tablet -- but the rows are only ever removed when a browser
 * says the endpoint is dead, so a person who reinstalls a lot accumulates them.
 */
export const MAX_DEVICES_PER_OWNER = 10;

/** Every device one owner is listening on, bounded. */
export async function devicesOf(ctx: QueryCtx, owner: string) {
  return await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_owner", (q) => q.eq("owner", owner))
    .take(MAX_DEVICES_PER_OWNER);
}

/**
 * Every subscription filed under one owner, gone.
 *
 * Called by `account.deleteAccount`. A hard delete even though the profile
 * tombstone is soft and restorable -- a person who has deleted their account
 * must stop receiving notifications at the tap, and re-subscribing after a
 * restore is one tap.
 *
 * A helper and not a Convex function. Its callers already did their own
 * authorisation, and a public "delete this owner's subscriptions" endpoint is a
 * way to silence somebody.
 */
export async function dropOwner(
  ctx: MutationCtx,
  owner: string,
): Promise<void> {
  for (const row of await devicesOf(ctx, owner)) {
    await ctx.db.delete(row._id);
  }
}

/** What one notification puts on a lock screen, and where tapping it goes. */
export type Notification = { title: string; body: string; url: string };
