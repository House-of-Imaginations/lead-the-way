/**
 * Convex components are separate deployments, so `convexTest` does not know
 * about them until each one is registered against the test instance. Miss one
 * and every call into it fails with an unhelpful "component not found".
 *
 * Register the same set as `convex/convex.config.ts`, under the same names.
 */
import betterAuth from "@convex-dev/better-auth/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import resend from "@convex-dev/resend/test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import type { TestConvex } from "convex-test";
import { components } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const componentTest = (t: TestConvex<typeof schema>) =>
  t as unknown as TestConvex<SchemaDefinition<GenericSchema, boolean>>;

export function registerComponents(t: TestConvex<typeof schema>): void {
  const generic = componentTest(t);
  betterAuth.register(generic, "betterAuth");
  rateLimiter.register(generic, "rateLimiter");
  resend.register(generic, "resend");
}

/**
 * Put a real row in the auth component's `user` table, and hand back the
 * identity that matches it.
 *
 * NEEDED BECAUSE `t.withIdentity` IS ONLY CLAIMS. A JWT is whatever it was
 * minted with, so anything the product must not be lied to about -- whether an
 * address is verified, in `convex/invites.ts` -- is read from the auth
 * component's own document instead. In a test that document has to exist, or
 * the check under test is never reached. The Better Auth user id IS the Convex
 * document id in this adapter, which is why the identity's `subject` is the id
 * that comes back rather than a name chosen here.
 */
export async function seedAuthUser(
  t: TestConvex<typeof schema>,
  user: { name: string; email: string; emailVerified: boolean },
): Promise<{ subject: string }> {
  const now = Date.now();
  const created = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: { ...user, createdAt: now, updatedAt: now },
      },
    }),
  );
  return { subject: created._id };
}
