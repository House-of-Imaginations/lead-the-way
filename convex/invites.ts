import { v } from "convex/values";
import { authComponent } from "./auth";
import {
  authenticatedMutation,
  authenticatedQuery,
  orgMutation,
  orgQuery,
  publicQuery,
} from "./lib/customFunctions";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { setActiveOrgOf } from "./lib/account/ensureProfile";
import { profileOf } from "./lib/account/profile";
import { emailConfigured } from "./lib/email/send";
import { throwUserError } from "./lib/errors";
import { sendInvite } from "./lib/orgs/email";
import { INVITE_WINDOW_MS, mintToken } from "./lib/orgs/invites";
import {
  assertCanJoin,
  permissionsOf,
  requireWithin,
} from "./lib/orgs/membership";
import { insertPerson } from "./lib/orgs/people";
import { reserveRateLimit } from "./lib/rateLimits";

/**
 * Invitations: a link that turns whoever opens it into a member.
 *
 * WHAT PROTECTS THE TOKEN. It is stored in plaintext, because a shareable link
 * has to be readable again by the admin who made it, and a hash would forbid
 * that. What keeps it private instead is that no return validator reachable
 * without `members:manage` contains the column -- the same guard `profiles`
 * uses for `avatarId`. A return validator is a leak guard, not documentation.
 *
 * Accepting DELETES the row rather than stamping it used. A consumed row
 * holding a live-looking credential is a thing somebody has to keep explaining,
 * and deleting makes `by_org` exactly the set of pending invitations with
 * nothing to filter out.
 */

const MAX_INVITES_PER_ORG = 100;

/** What an invitation calls the person who sent it. */
async function nameOf(ctx: QueryCtx | MutationCtx, userId: string) {
  const profile = await profileOf(ctx, userId);
  if (profile?.displayName) return profile.displayName;
  const user = await authComponent.getAnyUserById(ctx, userId);
  return user?.name || user?.email || "Someone";
}

const inviteValidator = v.object({
  _id: v.id("orgInvites"),
  token: v.string(),
  email: v.union(v.string(), v.null()),
  roleId: v.id("orgRoles"),
  roleName: v.string(),
  expiresAt: v.number(),
});

/** Pending invitations. Gated, because the token is in the answer. */
export const list = orgQuery("members:manage")({
  args: {},
  returns: v.array(inviteValidator),
  handler: async (ctx) => {
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(MAX_INVITES_PER_ORG);

    const now = Date.now();
    const live = [];
    for (const invite of invites) {
      if (invite.expiresAt <= now) continue;
      const role = await ctx.db.get(invite.roleId);
      if (!role) continue;
      live.push({
        _id: invite._id,
        token: invite.token,
        email: invite.email ?? null,
        roleId: invite.roleId,
        roleName: role.name,
        expiresAt: invite.expiresAt,
      });
    }
    return live;
  },
});

export const create = orgMutation("members:manage")({
  args: {
    roleId: v.id("orgRoles"),
    email: v.optional(v.string()),
  },
  returns: v.object({
    token: v.string(),
    expiresAt: v.number(),
    /** False when no sending domain is configured. See `lib/orgs/email.ts`. */
    emailed: v.boolean(),
  }),
  handler: async (ctx, { roleId, email }) => {
    // Before any write, so a refusal costs nothing. Keyed per account: the
    // budget being protected is this product's sending reputation, and the
    // person choosing the addresses is the one to hold to it.
    await reserveRateLimit(ctx, "orgInvite", ctx.userId);

    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== ctx.orgId) {
      throwUserError("NOT_FOUND", "That role no longer exists.");
    }
    // Ownership is handed over deliberately, by an owner, to a person they
    // name -- never by a link that whoever opens it becomes an owner.
    if (role.kind === "owner") {
      throwUserError(
        "FORBIDDEN",
        "Ownership cannot be given away with an invitation link.",
      );
    }
    requireWithin(permissionsOf(role), ctx);

    const now = Date.now();

    /**
     * THE CAP COUNTS LIVE INVITATIONS, AND SWEEPS THE DEAD ONES ON THE WAY.
     *
     * Counting every row instead was a permanent brick: nothing else deletes a
     * lapsed invitation -- there is no cron over this table -- so once a
     * hundred had ever been minted and expired, `create` refused forever with
     * "revoke some first", and `list` had already filtered those rows out, so
     * there was nothing to revoke and no way to see what was in the way.
     *
     * Swept here rather than by a cron because this is the one function that
     * has to read the range anyway. The work is bounded by the same cap, and a
     * deployment that never invites anybody never pays for it.
     */
    const rows = await ctx.db
      .query("orgInvites")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .take(MAX_INVITES_PER_ORG);

    let live = 0;
    for (const row of rows) {
      if (row.expiresAt <= now) await ctx.db.delete(row._id);
      else live += 1;
    }
    if (live >= MAX_INVITES_PER_ORG) {
      throwUserError(
        "FIELD_REQUIRED",
        "There are too many invitations open. Revoke some first.",
      );
    }
    const token = mintToken();
    const to = email?.trim().toLowerCase() || undefined;
    await ctx.db.insert("orgInvites", {
      orgId: ctx.orgId,
      roleId,
      token,
      email: to,
      invitedBy: ctx.userId,
      expiresAt: now + INVITE_WINDOW_MS,
      createdAt: now,
    });

    // Only when an address was named. A shareable link has nowhere to go, and
    // the caller copies it from `list` instead.
    let emailed = false;
    if (to) {
      const org = await ctx.db.get(ctx.orgId);
      emailed = await sendInvite(ctx, {
        to,
        orgName: org?.name ?? "a workspace",
        roleName: role.name,
        inviterName: await nameOf(ctx, ctx.userId),
        token,
      });
    }

    return { token, expiresAt: now + INVITE_WINDOW_MS, emailed };
  },
});

/**
 * Send a pinned invitation's email again, and give it a fresh week.
 *
 * The expiry moves because the new email says "expires in seven days", and an
 * email that is wrong about its own link is worse than none. Same rate limit as
 * `create`: a resend is a send.
 */
export const resend = orgMutation("members:manage")({
  args: { inviteId: v.id("orgInvites") },
  returns: v.object({ emailed: v.boolean() }),
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.orgId !== ctx.orgId) {
      throwUserError("NOT_FOUND", "That invitation no longer exists.");
    }
    if (!invite.email) {
      throwUserError(
        "FIELD_REQUIRED",
        "That invitation is a link, not an email. Copy the link instead.",
      );
    }
    const role = await ctx.db.get(invite.roleId);
    if (!role) {
      throwUserError("NOT_FOUND", "That invitation's role no longer exists.");
    }
    await reserveRateLimit(ctx, "orgInvite", ctx.userId);

    await ctx.db.patch(invite._id, {
      expiresAt: Date.now() + INVITE_WINDOW_MS,
    });
    const org = await ctx.db.get(ctx.orgId);
    const emailed = await sendInvite(ctx, {
      to: invite.email,
      orgName: org?.name ?? "a workspace",
      roleName: role.name,
      inviterName: await nameOf(ctx, ctx.userId),
      token: invite.token,
    });
    return { emailed };
  },
});

export const revoke = orgMutation("members:manage")({
  args: { inviteId: v.id("orgInvites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }): Promise<null> => {
    const invite = await ctx.db.get(inviteId);
    // Already gone is not an error: revoking twice is a double tap.
    if (invite && invite.orgId === ctx.orgId) {
      await ctx.db.delete(invite._id);
    }
    return null;
  },
});

/** What the signed-out join page may show. Nothing about the role or the pinned address. */
export const publicPreview = publicQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      orgName: v.string(),
      orgImageUrl: v.union(v.string(), v.null()),
      emailPinned: v.boolean(),
    }),
  ),
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("orgInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite || invite.expiresAt <= Date.now()) return null;
    const org = await ctx.db.get(invite.orgId);
    if (!org) return null;
    return {
      orgName: org.name,
      orgImageUrl: org.imageId ? await ctx.storage.getUrl(org.imageId) : null,
      emailPinned: invite.email !== undefined,
    };
  },
});

/**
 * What a link shows before somebody commits to it. No token echoed back.
 *
 * `access` answers "can I press Join?" ahead of time, so the page can say what
 * to do instead of letting `accept` fail. It never names the pinned address:
 * `wrongAccount` tells the holder only that this account is not the one.
 */
export const preview = authenticatedQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      orgName: v.string(),
      roleName: v.string(),
      invitedBy: v.string(),
      access: v.union(
        v.literal("ready"),
        v.literal("confirmEmail"),
        v.literal("wrongAccount"),
      ),
      acceptState: v.union(
        v.literal("READY"),
        v.literal("VERIFY_EMAIL"),
        v.literal("WRONG_ACCOUNT"),
        v.literal("ALREADY_MEMBER"),
      ),
      emailConfigured: v.boolean(),
    }),
  ),
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("orgInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!invite || invite.expiresAt <= Date.now()) return null;

    const org = await ctx.db.get(invite.orgId);
    const role = await ctx.db.get(invite.roleId);
    if (!org || !role) return null;

    let access: "ready" | "confirmEmail" | "wrongAccount" = "ready";
    if (invite.email) {
      const user = await authComponent.getAnyUserById(ctx, ctx.userId);
      const email = user?.email?.trim().toLowerCase();
      if (email !== invite.email) access = "wrongAccount";
      else if (user?.emailVerified !== true) access = "confirmEmail";
    }

    const member = await ctx.db
      .query("people")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", ctx.userId).eq("orgId", invite.orgId),
      )
      .unique();
    return {
      orgName: org.name,
      roleName: role.name,
      invitedBy: await nameOf(ctx, invite.invitedBy),
      access,
      acceptState:
        access === "wrongAccount"
          ? ("WRONG_ACCOUNT" as const)
          : access === "confirmEmail"
            ? ("VERIFY_EMAIL" as const)
            : member
              ? ("ALREADY_MEMBER" as const)
              : ("READY" as const),
      emailConfigured: emailConfigured(),
    };
  },
});

/**
 * Take up an invitation.
 *
 * INSERT ONLY, and that is a security property rather than a simplification.
 * If this patched an existing seat's role, any invitation link would be
 * a self-demotion primitive: an owner opens a "member" link somebody sent them
 * and is demoted out of their own workspace. So an existing member consumes the
 * link and keeps the role they already had.
 *
 * One mutation, so it is one transaction: the token read is in the read set,
 * which is what makes two simultaneous accepts of the same link safe without a
 * lock. It must stay a mutation -- moving the email side of it in here would
 * make it an action, and an action is not a transaction.
 */
export const accept = authenticatedMutation({
  args: { token: v.string() },
  returns: v.object({ slug: v.string(), orgId: v.id("orgs") }),
  handler: async (
    ctx,
    { token },
  ): Promise<{ slug: string; orgId: Id<"orgs"> }> => {
    const invite = await ctx.db
      .query("orgInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    // Not found and already used are the same answer on purpose: telling them
    // apart turns this into an oracle for guessing tokens.
    if (!invite) {
      throwUserError("INVITE_INVALID", "That invitation is no longer valid.");
    }
    if (invite.expiresAt <= Date.now()) {
      await ctx.db.delete(invite._id);
      throwUserError("INVITE_EXPIRED", "That invitation has expired.");
    }

    const org = await ctx.db.get(invite.orgId);
    const role = await ctx.db.get(invite.roleId);
    // Fails closed: a link pinned to a role that has since gone grants nothing.
    if (!org || !role || role.orgId !== invite.orgId) {
      await ctx.db.delete(invite._id);
      throwUserError("INVITE_INVALID", "That invitation is no longer valid.");
    }

    // A pinned address is enforced, or it is a guarantee the column only
    // appears to make. Checked against the verified address, because an
    // unverified one is a claim rather than a fact.
    //
    // READ FROM THE AUTH COMPONENT'S OWN ROW, not from the JWT. The identity
    // claims are whatever the token was minted with, and `emailVerified` is
    // not a claim this product controls the shape of: absent, or a string
    // "true", and `!== true` would refuse every pinned invitation forever with
    // a message blaming the wrong address. The component's user document has
    // both fields typed, and it is the record verification actually writes to.
    //
    // `getAnyUserById` rather than `safeGetAuthUser`, which looks like the
    // obvious call and is not: it resolves the session from `identity.sessionId`
    // first, so it depends on a second claim to answer a question the user id
    // alone already answers.
    if (invite.email) {
      const user = await authComponent.getAnyUserById(ctx, ctx.userId);
      const email = user?.email?.trim().toLowerCase();
      if (!email || email !== invite.email) {
        throwUserError(
          "INVITE_INVALID",
          "That invitation was sent to a different email address.",
        );
      }
      // The right address, not yet proved. Said as such, because "a different
      // address" sent the right person looking for a typo that was not there.
      if (user?.emailVerified !== true) {
        throwUserError(
          "EMAIL_UNVERIFIED",
          "Confirm your email address first, then open this invitation again.",
        );
      }
    }

    const existing = await ctx.db
      .query("people")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", ctx.userId).eq("orgId", invite.orgId),
      )
      .unique();

    // Consume the link, leave the role alone. See the note above.
    if (existing) {
      await ctx.db.delete(invite._id);
      await setActiveOrgOf(ctx, ctx.userId, invite.orgId);
      return { slug: org.slug, orgId: invite.orgId };
    }

    // The only door into a workspace, so the only place the ceilings can be
    // held. `members.list` and `deleteOrg` both assume they are.
    await assertCanJoin(ctx, ctx.userId, invite.orgId);

    await insertPerson(ctx, ctx.userId, invite.orgId, invite.roleId);
    await ctx.db.delete(invite._id);
    await setActiveOrgOf(ctx, ctx.userId, invite.orgId);
    return { slug: org.slug, orgId: invite.orgId };
  },
});
