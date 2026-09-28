import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The product's own record of a person, keyed by the Better Auth user id.
 *
 * Deliberately NOT the auth component's user row. That row belongs to Better
 * Auth and its shape is the component's business; this one is the product's,
 * and every field a feature wants to remember about somebody belongs here.
 */
export const profileTables = {
  profiles: defineTable({
    userId: v.string(),
    displayName: v.string(),
    /**
     * When this account was deleted, and the whole of the tombstone.
     *
     * Deletion is soft on purpose: the person has a window in which signing
     * back in restores them, and `account.purgeExpired` erases the row for good
     * once that window closes. So this field is a date, not a flag -- the date
     * IS the deadline. `profiles.me` returns null while it is set, so a deleted
     * account looks signed-out to the rest of the product without any other
     * screen having to know this column exists.
     */
    deletedAt: v.optional(v.number()),
    // Set by `account.purgeExpired` before it deletes anything. A purge can span
    // several runs, and a restore in between would bring back an account with
    // some of its data gone, so `restoreAccount` refuses once this is set.
    purgeStartedAt: v.optional(v.number()),
    // The picture in this person's roundel, as a storage id and never a URL.
    // A stored URL would be a signed, expiring string baked into a row: it goes
    // stale on its own schedule and nothing here would know. `profiles.me`
    // resolves it through `ctx.storage.getUrl` on every read instead, which is
    // the only value that is true at the moment it is used.
    avatarId: v.optional(v.id("_storage")),
    // The workspace the app opens; orgs.active falls back when the seat is gone.
    activeOrgId: v.optional(v.id("orgs")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    // The purge job's read path. Without it, the daily cron is a full scan of
    // a table that grows with every account the product ever had.
    .index("by_deletedAt", ["deletedAt"]),
};
