import type { QueryCtx, MutationCtx, ActionCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
import { profileOf } from "../account/profile";

type Ctx = QueryCtx | MutationCtx;
type AnyCtx = Ctx | ActionCtx;

/**
 * Identity is always derived here, never passed in as an argument.
 *
 * `subject` is the Better Auth user id (the convex() plugin puts it there), so
 * it is what `profiles.userId` stores and what `t.withIdentity({ subject })`
 * drives in tests. There is exactly one issuer, so subject is unambiguous --
 * do not swap this for tokenIdentifier.
 *
 * The rule this file exists to enforce: no Convex function may accept a user id
 * as an argument for authorisation. An argument is something a client chooses.
 */
export async function safeUserId(ctx: AnyCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export async function requireUserId(ctx: AnyCtx): Promise<string> {
  const userId = await safeUserId(ctx);
  if (!userId)
    throwUserError("NOT_SIGNED_IN", "You need to be signed in to do that.");
  return userId;
}

/**
 * Signed in, AND not on the way out.
 *
 * A soft-deleted account still holds a valid session until the tab is closed,
 * so "signed in" and "allowed to write" are different questions. Use this on
 * anything that creates state the deletion would have to clean up later; plain
 * `requireUserId` is enough for reads and for anything the purge already
 * removes.
 */
export async function requireLiveUserId(ctx: Ctx): Promise<string> {
  const userId = await requireUserId(ctx);

  const profile = await profileOf(ctx, userId);
  // No profile is not a tombstone -- it is somebody who has not filled in a
  // name yet, and they are a live account.
  if (profile?.deletedAt !== undefined) {
    throwUserError(
      "ACCOUNT_DELETED",
      "This account is being deleted. Restore it first, and then you can carry on.",
    );
  }
  return userId;
}
