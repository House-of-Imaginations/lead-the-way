import {
  HOUR,
  MINUTE,
  RateLimiter,
  type RateLimitError,
} from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

/**
 * Every rate limit in the product, declared in one place. A token bucket
 * refills continuously and allows bursts up to `capacity`.
 */
const limits = {
  // Creating an invitation, per account: the email goes out under this
  // product's sending domain, which is the reputation at risk.
  orgInvite: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  // Invitation emails that really go out, per account (Ruling 5). Spent in
  // `sendInvite` only, so the demo and email-off deployments never spend one.
  inviteEmail: { kind: "token bucket", rate: 50, period: HOUR, capacity: 50 },
} as const;

/** At most this many addresses in one launch (Ruling 5). */
export const MAX_LAUNCH_INVITES = 50;

export const rateLimiter = new RateLimiter(components.rateLimiter, limits);

function isOfficialRateLimitError(
  error: unknown,
): error is { data: RateLimitError } {
  if (!(error instanceof ConvexError)) return false;
  const data: unknown = error.data;
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    record.kind === "RateLimited" &&
    typeof record.name === "string" &&
    typeof record.retryAfter === "number"
  );
}

/**
 * Consume one token, or throw the product's own `RATE_LIMITED` error.
 *
 * The translation is the point. The component throws its own shape, and a
 * client branching on that shape would be coupled to the component's internals;
 * `convex/lib/errors.ts` owns the codes the browser is allowed to see.
 * `retryAfter` is carried through because a screen that cannot say when to try
 * again has to guess.
 */
export async function reserveRateLimit(
  ctx: MutationCtx,
  name: keyof typeof limits,
  key?: string,
): Promise<void> {
  try {
    await rateLimiter.limit(
      ctx,
      name,
      key === undefined ? { throws: true } : { key, throws: true },
    );
  } catch (error) {
    if (!isOfficialRateLimitError(error)) throw error;
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
      kind: "RateLimited",
      name: error.data.name,
      retryAfter: error.data.retryAfter,
    });
  }
}
