import {
  DAY,
  MINUTE,
  RateLimiter,
  type RateLimitError,
} from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

/**
 * Every rate limit in the product, declared in one place.
 *
 * Two kinds, and they answer different questions. A PER-CALLER limit
 * (`userExample`, `pushTest`) is keyed on the caller and protects the product
 * from one person; a PROVIDER limit (`openaiMinute`, `openaiDay`) has no key at
 * all and protects an upstream account's quota from the whole deployment at
 * once. Do not merge the two -- a shared bucket means one heavy user can spend
 * the provider budget everyone else is queued behind, and neither cap can be
 * tuned without moving the other.
 *
 * A token bucket refills continuously and allows bursts up to `capacity`; a
 * fixed window resets on the hour or day and is what an upstream daily quota
 * actually is.
 */
const limits = {
  // A per-account cap for anything a screen can trigger repeatedly. Copy this
  // shape for a new limit rather than reusing one that belongs to something
  // else -- one name per thing being limited, so the numbers stay readable.
  userExample: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  // The settings screen's "send a test". Keyed per account. Generous enough
  // that somebody checking whether their phone is set up correctly never meets
  // it, tight enough that the one public endpoint whose whole purpose is to
  // cause outbound traffic cannot be held down.
  pushTest: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  // Creating an invitation. Keyed per account, because the abuse is one person
  // using a workspace they legitimately administer as a mailing machine: the
  // address is theirs to choose and the email goes out under this product's
  // sending domain, which is the reputation actually at risk. Ten a minute is
  // far above filling in a team and far below anything worth doing on purpose.
  orgInvite: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 10 },
  openaiMinute: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 30,
  },
  openaiDay: {
    kind: "fixed window",
    rate: 200,
    period: DAY,
    capacity: 200,
    start: 0,
  },
} as const;

export const rateLimiter = new RateLimiter(components.rateLimiter, limits);

// Exposed so a test can drain "every token but one" without hard-coding a
// number that would silently go stale if the limit above changes.
export const OPENAI_MINUTE_CAPACITY = limits.openaiMinute.capacity;

export const providerValidator = v.union(v.literal("openai"));

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
