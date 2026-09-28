import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  providerValidator,
  rateLimiter,
  reserveRateLimit,
} from "./lib/rateLimits";
import {
  isRateLimitedError,
  providerQuotaUnavailableError,
  throwUserError,
} from "./lib/errors";
import { safeUserId } from "./lib/auth/identity";

/**
 * The rate limiter, reachable from an action.
 *
 * WHY THIS FILE EXISTS AT ALL. `rateLimiter.limit` writes, so it is mutation-
 * only -- an action that wants to reserve admission before spending money with
 * a provider cannot call it directly and has to go through `ctx.runMutation`.
 * These are those mutations, and they are `internal` so nothing outside the
 * backend can spend somebody else's tokens. A mutation that is already a
 * mutation should call `reserveRateLimit` from the lib directly instead.
 *
 * CHECK AND RESERVE ARE DIFFERENT OPERATIONS. `check*` is read-only and answers
 * "would this be allowed" for a screen that wants to disable a button;
 * `reserve*` consumes. Never use a check as a gate -- between the check and the
 * work, somebody else spends the token.
 */

const userNames = { example: "userExample" } as const;

export const userFamilyValidator = v.union(v.literal("example"));

/** Consume one per-account admission. */
export const reserveUserRequest = internalMutation({
  args: { family: userFamilyValidator },
  returns: v.null(),
  handler: async (ctx, { family }): Promise<null> => {
    const userId = await safeUserId(ctx);
    if (!userId)
      throwUserError("NOT_SIGNED_IN", "You need to be signed in to do that.");
    await reserveRateLimit(ctx, userNames[family], `${userId}:${family}`);
    return null;
  },
});

/** Read-only admission check. It never consumes tokens. */
export const checkUserRequest = internalQuery({
  args: { family: userFamilyValidator },
  returns: v.boolean(),
  handler: async (ctx, { family }) => {
    const userId = await safeUserId(ctx);
    if (!userId) return false;
    return (
      await rateLimiter.check(ctx, userNames[family], {
        key: `${userId}:${family}`,
      })
    ).ok;
  },
});

/** Read-only provider admission check for the next provider batch. */
export const checkProvider = internalQuery({
  args: { provider: providerValidator },
  returns: v.object({ minute: v.boolean(), day: v.boolean() }),
  handler: async (ctx) => ({
    minute: (await rateLimiter.check(ctx, "openaiMinute")).ok,
    day: (await rateLimiter.check(ctx, "openaiDay")).ok,
  }),
});

/**
 * Reserve one physical provider attempt under both the minute and the UTC-day
 * cap. Both, in that order: a day's quota spent in a minute is still spent.
 */
export const reserveProvider = internalMutation({
  args: { provider: providerValidator },
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    try {
      await reserveRateLimit(ctx, "openaiMinute");
      await reserveRateLimit(ctx, "openaiDay");
    } catch (error) {
      if (isRateLimitedError(error)) throw error;
      throw providerQuotaUnavailableError();
    }
    return null;
  },
});
