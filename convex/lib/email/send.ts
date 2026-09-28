import { Resend } from "@convex-dev/resend";
import { components } from "../../_generated/api";
import { renderEmail, type EmailContent } from "./template";

/**
 * The one place this product sends email from.
 *
 * ENV-GATED, AND THAT IS THE FEATURE. With no `RESEND_API_KEY` and no
 * `RESEND_FROM`, every send here is skipped and says so in its return value.
 * Whatever caused it still happened: an invitation is still created and its
 * link still works. This is the doctrine `convex/auth.ts` already follows -- a
 * feature detects its own absence rather
 * than making a deployment that has not configured it unusable.
 *
 * It also keeps the network guard in `tests/setup.ts` satisfied without a stub,
 * because the test environment sets neither variable.
 *
 * `testMode: false` because the gate above is already the safety: nothing goes
 * out at all until somebody deliberately sets a from-address on a domain they
 * verified. Leaving it true would mean a correctly-configured deployment
 * silently refusing every real address.
 *
 * THE CTX IS `RunMutationCtx`, NOT `MutationCtx`, so Better Auth's own senders
 * can reach this from inside an HTTP action. The component owns delivery
 * through its own workpool, so a caller that IS a mutation gets the send in the
 * same transaction as whatever caused it -- no email about a row that rolled
 * back, and no row whose email was never queued.
 */
export const resend: Resend = new Resend(components.resend, {
  testMode: false,
});

/**
 * Whatever the component accepts, derived rather than restated.
 *
 * It is narrower than a `MutationCtx` on purpose -- `runQuery` and `runMutation`
 * and nothing else -- which is what lets a mutation, an action, and Better
 * Auth's own senders inside an HTTP action all reach this with the same
 * signature. Derived so an upgrade that widens or narrows it is a type error
 * here rather than a runtime surprise in three call sites.
 */
export type EmailCtx = Parameters<Resend["sendEmail"]>[0];

/** Whether this deployment can send at all. Cheap, and worth asking first. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

/**
 * Send one templated email. Returns whether it was actually queued, so a
 * screen can say "we sent it" only when that is true.
 */
export async function sendEmail(
  ctx: EmailCtx,
  to: string,
  subject: string,
  content: EmailContent,
): Promise<boolean> {
  const from = process.env.RESEND_FROM;
  if (!from || !process.env.RESEND_API_KEY) return false;

  const { html, text } = renderEmail(
    content,
    // Uploaded to Convex storage by `scripts/upload-email-logo.mjs`.
    process.env.EMAIL_LOGO_URL,
  );
  await resend.sendEmail(ctx, { from, to, subject, html, text });
  return true;
}
