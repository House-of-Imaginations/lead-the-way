import type { MutationCtx } from "../../_generated/server";
import { sendInviteEmail } from "../email/messages";

/**
 * The invitation email, and the one thing this file decides: where the link
 * points.
 *
 * Everything else -- whether the deployment can send at all, the markup, the
 * escaping, the plain-text part -- belongs to `convex/lib/email/`, which every
 * email in this product goes through. This is the workspace-shaped half.
 */
export async function sendInvite(
  ctx: MutationCtx,
  invite: {
    to: string;
    orgName: string;
    roleName: string;
    inviterName: string;
    token: string;
  },
): Promise<boolean> {
  // The origin Better Auth is already configured with, so a link in an email
  // and a link in the browser cannot disagree about which deployment this is.
  const site = process.env.SITE_URL;
  if (!site) return false;

  return await sendInviteEmail(ctx, {
    to: invite.to,
    orgName: invite.orgName,
    roleName: invite.roleName,
    inviterName: invite.inviterName,
    link: `${site}/join/${invite.token}`,
  });
}
