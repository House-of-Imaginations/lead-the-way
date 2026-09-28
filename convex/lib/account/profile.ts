import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/**
 * Find somebody's profile row. The one read every account function starts with,
 * written once so nobody forgets `withIndex` and leaves a table scan behind.
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
