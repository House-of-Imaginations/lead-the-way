import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { authComponent } from "../../auth";
import { insertProfile, profileOf } from "./profile";

/**
 * The profile, created from the auth account when missing. The trigger in
 * `convex/auth.ts` creates one at sign-up; this covers accounts that predate it.
 */
export async function ensureProfile(
  ctx: MutationCtx,
  userId: string,
): Promise<Doc<"profiles">> {
  const profile = await profileOf(ctx, userId);
  if (profile) return profile;
  const user = await authComponent.getAnyUserById(ctx, userId);
  return await insertProfile(
    ctx,
    userId,
    user?.name || user?.email?.split("@")[0],
  );
}

export async function setActiveOrgOf(
  ctx: MutationCtx,
  userId: string,
  orgId: Id<"orgs">,
): Promise<void> {
  const profile = await ensureProfile(ctx, userId);
  await ctx.db.patch(profile._id, { activeOrgId: orgId });
}

/** How an actor field reads on screen. Actor ids outlive seats and profiles. */
export async function displayNameOf(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<string> {
  const profile = await profileOf(ctx, userId);
  if (profile) return profile.displayName;
  const user = await authComponent.getAnyUserById(ctx, userId);
  return user?.email ?? "Former member";
}
