import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  authenticatedMutation,
  authenticatedQuery,
} from "./lib/customFunctions";
import { INBOX_CAP } from "./lib/push/inbox";
import { notificationEventValidator } from "./lib/push/preferences";

/**
 * The signed-in person's notification inbox.
 *
 * Account-wide, not per workspace, the same as push: a notification is a fact
 * about the person, and each one's `url` opens a page that does its own
 * access check. Every function reads `ctx.userId` from the server; a row that
 * belongs to somebody else answers the same as a row that does not exist.
 */

const inboxRow = v.object({
  _id: v.id("notifications"),
  _creationTime: v.number(),
  event: notificationEventValidator,
  title: v.string(),
  body: v.string(),
  url: v.string(),
  readAt: v.optional(v.number()),
});

/** Newest first. Never more than `INBOX_CAP`, because the table is capped. */
export const list = authenticatedQuery({
  args: {},
  returns: v.array(inboxRow),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_clearedAt", (q) =>
        q.eq("userId", ctx.userId).eq("clearedAt", undefined),
      )
      .order("desc")
      .take(INBOX_CAP);
    return rows.map(
      ({ _id, _creationTime, event, title, body, url, readAt }) => ({
        _id,
        _creationTime,
        event,
        title,
        body,
        url,
        readAt,
      }),
    );
  },
});

export const unreadCount = authenticatedQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => (await unread(ctx, ctx.userId)).length,
});

export const markRead = authenticatedMutation({
  args: { id: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await own(ctx, ctx.userId, id);
    if (row && row.readAt === undefined)
      await ctx.db.patch(id, { readAt: Date.now() });
    return null;
  },
});

export const markAllRead = authenticatedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for (const row of await unread(ctx, ctx.userId))
      await ctx.db.patch(row._id, { readAt: now });
    return null;
  },
});

/** Gone for good. A double tap, or someone else's id, is a no-op. */
export const clear = authenticatedMutation({
  args: { id: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    if (await own(ctx, ctx.userId, id)) await ctx.db.delete(id);
    return null;
  },
});

/**
 * Hide every row, stamped with one time so `undoClearAll` can bring exactly
 * this batch back. The stamped rows stay in the table until the cap trims them.
 */
export const clearAll = authenticatedMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const clearedAt = Date.now();
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_clearedAt", (q) =>
        q.eq("userId", ctx.userId).eq("clearedAt", undefined),
      )
      .take(INBOX_CAP);
    for (const row of rows) await ctx.db.patch(row._id, { clearedAt });
    return clearedAt;
  },
});

export const undoClearAll = authenticatedMutation({
  args: { clearedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { clearedAt }) => {
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_clearedAt", (q) =>
        q.eq("userId", ctx.userId).eq("clearedAt", clearedAt),
      )
      .take(INBOX_CAP);
    for (const row of rows)
      await ctx.db.patch(row._id, { clearedAt: undefined });
    return null;
  },
});

async function own(ctx: MutationCtx, userId: string, id: Id<"notifications">) {
  const row = await ctx.db.get(id);
  return row && row.userId === userId && row.clearedAt === undefined
    ? row
    : null;
}

function unread(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("notifications")
    .withIndex("by_userId_and_clearedAt_and_readAt", (q) =>
      q.eq("userId", userId).eq("clearedAt", undefined).eq("readAt", undefined),
    )
    .take(INBOX_CAP);
}
