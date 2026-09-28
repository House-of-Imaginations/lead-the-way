import { defineTable } from "convex/server";
import { v } from "convex/values";
import { notificationEventValidator } from "../lib/push/preferences";

/**
 * The in-app copy of every notification a person was sent.
 *
 * Written by `deliverNotification` in `convex/lib/push/inbox.ts` at the same
 * point the push is queued, so the inbox and the lock screen always agree on
 * who was told and what they were told -- the same generic copy, with no
 * private content.
 *
 * `seq` counts up per recipient and is what the row cap trims on; see
 * `INBOX_CAP`. `clearedAt` is set by "Clear all" so the toast's Undo can bring
 * the rows back; a single "Clear" deletes outright.
 */
export const inboxTables = {
  notifications: defineTable({
    userId: v.string(),
    orgId: v.id("orgs"),
    event: notificationEventValidator,
    title: v.string(),
    body: v.string(),
    url: v.string(),
    seq: v.number(),
    readAt: v.optional(v.number()),
    clearedAt: v.optional(v.number()),
  })
    .index("by_userId_and_seq", ["userId", "seq"])
    .index("by_userId_and_clearedAt", ["userId", "clearedAt"])
    .index("by_userId_and_clearedAt_and_readAt", [
      "userId",
      "clearedAt",
      "readAt",
    ]),
};
