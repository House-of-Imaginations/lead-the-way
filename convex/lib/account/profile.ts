import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/**
 * Find somebody's profile row. The one read every account function starts with.
 *
 * It existed eight times before it existed once: `profiles.me`, the three
 * avatar functions, `account.deletionStatus`, `deleteAccount`, `restoreAccount`
 * and `requireLiveUserId` each wrote out the same index read. Eight copies of a
 * read is eight places to forget `withIndex` and leave a table scan behind.
 *
 * IT DOES NOT CHECK THE TOMBSTONE, deliberately, and this is why it returns the
 * whole document rather than a "live profile or null". The callers genuinely
 * disagree about what `deletedAt` means to them: `me` refuses a tombstoned row,
 * `deletionStatus` and `restoreAccount` exist ONLY to act on one, and
 * `setAvatar` has to delete the upload it was handed before it returns. A
 * helper that folded the check in would be right for half of them and would
 * have to be worked around by the other half.
 */
export async function profileOf(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"profiles"> | null> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** A display name is one line of a person's own choosing, not an identity claim. */
export const MAX_DISPLAY_NAME = 40;

export async function insertProfile(
  ctx: MutationCtx,
  userId: string,
  name: string | null | undefined,
): Promise<Doc<"profiles">> {
  const id = await ctx.db.insert("profiles", {
    userId,
    displayName: name?.trim().slice(0, MAX_DISPLAY_NAME) || "Someone",
    createdAt: Date.now(),
  });
  const profile = await ctx.db.get(id);
  if (!profile) throw new Error("just-inserted profile is missing");
  return profile;
}
