import { defineTable } from "convex/server";
import { v } from "convex/values";
import { notificationEventValidator } from "../lib/push/preferences";

/**
 * One row per browser that has agreed to be told things.
 *
 * `owner` is the Better Auth subject of the account the subscription belongs
 * to, and it is an opaque key on purpose: if this product ever gains a second
 * kind of principal (a guest seat, a team, a device), it is filed under a
 * prefixed key built in one place -- `convex/lib/push/notify.ts` -- rather than
 * under a second optional column and a second index read on every delivery.
 *
 * NO `enabled` COLUMN. The row existing is the fact. A browser can revoke a
 * subscription without telling us, so a second source of truth would drift.
 */
export const pushTables = {
  pushSubscriptions: defineTable({
    owner: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner", ["owner"])
    // The endpoint is the browser, and it is what a re-subscription hands back
    // unchanged. Upserting on it is what stops one phone accumulating a row per
    // service-worker update and receiving everything five times.
    .index("by_endpoint", ["endpoint"]),

  /**
   * Which events an account wants to hear about. One row per event the
   * person has touched; NO ROW MEANS ON, so a new account needs no writes and a
   * new event reaches everybody who never said otherwise.
   *
   * Per account, not per device: "tell me when X happens" is a fact
   * about the person, and the device switch already says where.
   */
  notificationPreferences: defineTable({
    owner: v.string(),
    event: notificationEventValidator,
    enabled: v.boolean(),
  }).index("by_owner_and_event", ["owner", "event"]),
};
