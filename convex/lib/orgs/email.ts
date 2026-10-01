import type { MutationCtx } from "../../_generated/server";
import { isDemoAddress } from "../demo/cast";
import { sendInviteEmail } from "../email/messages";
import { emailConfigured } from "../email/send";
import { reserveRateLimit } from "../rateLimits";

/**
 * The invitation email, and the two things this file decides: where the link
 * points, and when a send spends the sender's `inviteEmail` token.
 *
 * Everything else -- whether the deployment can send at all, the markup, the
 * escaping, the plain-text part -- belongs to `convex/lib/email/`, which every
 * email in this product goes through. This is the workspace-shaped half.
 *
 * THE DEMO WORKSPACE IS THE CALLER'S CHECK. This has no org to ask, so
 * `sprints.launch`, `invites.create` and `invites.resend` skip it there.
 */

/** Whether this deployment can mail an invitation link at all. */
export function inviteEmailOn(): boolean {
  // The origin Better Auth is already configured with, so a link in an email
  // and a link in the browser cannot disagree about which deployment this is.
  return Boolean(process.env.SITE_URL) && emailConfigured();
}

export async function sendInvite(
  ctx: MutationCtx,
  invite: {
    to: string;
    orgName: string;
    roleName: string;
    inviterName: string;
    token: string;
    message?: string;
    /** The account sending it, whose hourly `inviteEmail` bucket pays. */
    senderId: string;
  },
): Promise<boolean> {
  // Only a send that would really go out spends a token (Ruling 5).
  if (!inviteEmailOn() || isDemoAddress(invite.to)) return false;
  await reserveRateLimit(ctx, "inviteEmail", invite.senderId);
  return await sendInviteEmail(ctx, {
    to: invite.to,
    orgName: invite.orgName,
    roleName: invite.roleName,
    inviterName: invite.inviterName,
    message: invite.message,
    link: `${process.env.SITE_URL}/join/${invite.token}`,
  });
}
