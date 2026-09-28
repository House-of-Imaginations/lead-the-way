import type { QueryCtx, MutationCtx, ActionCtx } from "../../_generated/server";
import { throwUserError } from "../errors";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

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
