import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { Notification } from "./notify";
import type { NotificationEvent } from "./preferences";
import { enqueuePush } from "./queue";

/** The most notifications one person keeps; older ones are trimmed on insert. */
export const INBOX_CAP = 200;

/**
 * Tell one person something: a row in their inbox, and a push to their devices.
 *
 * THE ONLY WAY A NOTIFICATION IS SENT. Writing the row here rather than beside
 * each caller is what keeps the inbox honest -- whatever scope and preference
 * checks a caller did before calling this apply to both halves at once.
 *
 * `userId` is a key the SERVER resolved, never a client argument; see
 * `enqueuePush`.
 */
export async function deliverNotification(
  ctx: MutationCtx,
  to: { userId: string; orgId: Id<"orgs">; event: NotificationEvent },
  notification: Notification,
): Promise<void> {
  const latest = await ctx.db
    .query("notifications")
    .withIndex("by_userId_and_seq", (q) => q.eq("userId", to.userId))
    .order("desc")
    .first();
  const seq = (latest?.seq ?? 0) + 1;
  await ctx.db.insert("notifications", { ...to, ...notification, seq });
  // ponytail: rows keep distinct seqs no higher than the newest, so deleting
  // everything at or below `seq - INBOX_CAP` holds a person to INBOX_CAP rows
  // with a two-row read. Each insert pushes at most one row past the line;
  // the `take` bound is slack, not a backlog drain.
  const expired = await ctx.db
    .query("notifications")
    .withIndex("by_userId_and_seq", (q) =>
      q.eq("userId", to.userId).lte("seq", seq - INBOX_CAP),
    )
    .take(4);
  for (const row of expired) await ctx.db.delete(row._id);
  await enqueuePush(ctx, to.userId, notification);
}
