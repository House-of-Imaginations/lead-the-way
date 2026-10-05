import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
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

/** Validate and trim a display name, then write it to the account's profile. */
export async function saveDisplayName(
  ctx: MutationCtx,
  userId: string,
  raw: string,
): Promise<string> {
  const name = raw.trim();
  if (!name) throwUserError("NAME_REQUIRED", "A name is required.");
  if (name.length > MAX_DISPLAY_NAME) {
    throwUserError(
      "NAME_REQUIRED",
      `A name can be at most ${MAX_DISPLAY_NAME} characters.`,
    );
  }
  // Not `ensureProfile`: it imports this module, and the name is already in hand.
  const profile = await profileOf(ctx, userId);
  if (profile) await ctx.db.patch(profile._id, { displayName: name });
  else await insertProfile(ctx, userId, name);
  return name;
}

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
