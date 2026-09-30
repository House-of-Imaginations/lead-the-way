import { v } from "convex/values";
import { authComponent } from "./auth";
import { ensureProfile } from "./lib/account/ensureProfile";
import { authenticatedMutation } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { MAX_ORG_NAME, createWorkspace } from "./lib/orgs/create";
import { getViewer } from "./lib/viewer";

/**
 * The step after sign-up, by email or a first social sign-in (R8). Returns
 * where to go next:
 *  - "/home" when the account already has a workspace;
 *  - "/join/<token>" when a live invitation names its address and the account
 *    has VERIFIED that address (the join page seats it, P6). Sign-up doesn't
 *    demand verification, so an unverified address proves nothing: the token
 *    is never returned to it (spec 5, "holding the link is the proof"). An
 *    invitation from the demo workspace never counts;
 *  - "/setup/team" after making a fresh workspace and team.
 * The terms box is asked once and stored on the profile.
 *
 * A demo persona never reaches a real workspace here: `invites.create`
 * refuses demo addresses, so no invitation matches, and `createWorkspace`
 * refuses demo accounts.
 */
export const start = authenticatedMutation({
  args: { acceptTerms: v.boolean() },
  returns: v.string(),
  handler: async (ctx, { acceptTerms }) => {
    const profile = await ensureProfile(ctx, ctx.userId);
    if (profile.termsAcceptedAt === undefined) {
      if (!acceptTerms) {
        throwUserError(
          "TERMS_REQUIRED",
          "Agree to the terms of use and privacy notice to continue.",
        );
      }
      await ctx.db.patch(profile._id, { termsAcceptedAt: Date.now() });
    }
    if (await getViewer(ctx)) return "/home";

    const user = await authComponent.getAnyUserById(ctx, ctx.userId);
    const email = user?.email?.trim().toLowerCase();
    if (email && user?.emailVerified === true) {
      const invites = ctx.db
        .query("orgInvites")
        .withIndex("by_email_status_and_expiresAt", (q) =>
          q
            .eq("email", email)
            .eq("status", "pending")
            .gt("expiresAt", Date.now()),
        );
      // The demo's invitations are the script's, never a real account's seat.
      for await (const invite of invites) {
        if (!(await ctx.db.get(invite.orgId))?.isDemo)
          return `/join/${invite.token}`;
      }
    }

    const first = user?.name?.trim().split(/\s+/)[0];
    const name = first ? `${first}'s workspace` : "";
    await createWorkspace(
      ctx,
      ctx.userId,
      name && name.length <= MAX_ORG_NAME ? name : "My workspace",
      { suffix: true },
    );
    return "/setup/team";
  },
});
