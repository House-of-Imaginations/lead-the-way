import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/**
 * The events a person can choose to be notified about. Whatever fires one
 * checks `isEnabled` below, then calls `deliverNotification`.
 */
// ponytail: one placeholder so the validator and settings screen compile;
// replace with the product's real events.
export const NOTIFICATION_EVENTS = ["example"] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const notificationEventValidator = v.union(
  ...NOTIFICATION_EVENTS.map((event) => v.literal(event)),
);

/** A missing row reads as on, the same default `myPreferences` draws. */
export async function isEnabled(
  ctx: QueryCtx | MutationCtx,
  owner: string,
  event: NotificationEvent,
): Promise<boolean> {
  const row = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_owner_and_event", (q) =>
      q.eq("owner", owner).eq("event", event),
    )
    .unique();
  return row?.enabled ?? true;
}
