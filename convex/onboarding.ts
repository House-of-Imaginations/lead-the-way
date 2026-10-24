import { v } from "convex/values";
import { authComponent } from "./auth";
import { ensureProfile } from "./lib/account/ensureProfile";
import { authenticatedMutation } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { normalEmail } from "./lib/inviteRules";
import { MAX_ORG_NAME, createWorkspace } from "./lib/orgs/create";
import { firstNameOf } from "./lib/orgs/people";
import { getViewer } from "./lib/viewer";

/**
 * The step after sign-up, by email or a first social sign-in (R8). Returns
 * where to go next:
 *  - "/join/<token>" when the sign-up came from a join link (Ruling 3). It
 *    makes nothing, whatever the token names. The join page says what's wrong
 *    with a link that won't seat this account (wrong address, used, demo,
 *    unknown), so a join link never ends in a fresh workspace;
 *  - "/home" for a career sign-up (`track: "career"`), with no workspace. It
 *    skips the invitation lookup below on purpose: a private career sign-up
 *    is never pulled into an employer's team by its address;
 *  - "/home" when the account already has a workspace;
 *  - "/join/<token>" when a live invitation names its address and the account
 *    has VERIFIED that address. Without the link in hand, an unverified
 *    address proves nothing, so the token is never returned to it (spec 5).
 *    An invitation from the demo workspace never counts;
 *  - "/setup/team" after making a fresh workspace and team.
 * The terms box is asked once and stored on the profile.
 *
 * A demo persona never reaches a real workspace here: an invitation from the
 * demo workspace never counts (above), a real workspace's invitation refuses
 * a demo account (`DEMO_ACCOUNT_JOIN`), and `createWorkspace` refuses demo
 * accounts. Nothing refuses a demo ADDRESS when inviting; `sendEmail` only
 * skips mailing one.
 */
export const start = authenticatedMutation({
  args: {
    acceptTerms: v.boolean(),
    token: v.optional(v.string()),
    track: v.optional(v.union(v.literal("team"), v.literal("career"))),
  },
  returns: v.string(),
  handler: async (ctx, { acceptTerms, token, track }) => {
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
    // Holding the link is the proof (spec 5); the join page checks the rest.
    if (token) return `/join/${encodeURIComponent(token)}`;
    // Spec 5.3: a career sign-up never makes a workspace. P12a's claimDraft makes
    // the career profile; until then /home resolves to /start.
    if (track === "career") return "/home";
    if (await getViewer(ctx)) return "/home";

    const user = await authComponent.getAnyUserById(ctx, ctx.userId);
    const email = normalEmail(user?.email ?? "") || undefined;
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

    const first = firstNameOf(user?.name ?? "");
    const name = first ? `${first}'s workspace` : "";
    await createWorkspace(
      ctx,
      ctx.userId,
      name && name.length <= MAX_ORG_NAME ? name : "My workspace",
    );
    return "/setup/team";
  },
});
