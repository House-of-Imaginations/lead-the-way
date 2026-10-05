import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { MAX_DISPLAY_NAME } from "../profileFields";

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

// Moved to the pure module so the Profile tab reads the same limit (P7b-1).
export { MAX_DISPLAY_NAME };

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
