import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { authComponent } from "./auth";
import {
  authenticatedMutation,
  authenticatedQuery,
  orgMutation,
  orgQuery,
  publicQuery,
} from "./lib/customFunctions";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { setActiveOrgOf } from "./lib/account/ensureProfile";
import { profileOf } from "./lib/account/profile";
import { emailConfigured } from "./lib/email/send";
import { throwUserError, type ErrorCode } from "./lib/errors";
import { sendInvite } from "./lib/orgs/email";
import { INVITE_WINDOW_MS, mintToken } from "./lib/orgs/invites";
import {
  MAX_MEMBERS_PER_ORG,
  assertCanJoin,
  findSeat,
  permissionsOf,
  requireWithin,
} from "./lib/orgs/membership";
import { insertPerson } from "./lib/orgs/people";
import { reserveRateLimit } from "./lib/rateLimits";

/**
 * Invitations: a link that seats whoever it was meant for.
 *
 * WHAT PROTECTS THE TOKEN. It is stored in plaintext, because a shareable link
 * has to be readable again by the manager who made it. What keeps it private
 * is that no return validator reachable without `members:manage` contains it.
 *
 * A ROW IS NEVER DELETED FOR BEING ANSWERED. `status` says what happened, so
 * every refusal can say exactly why (spec 5) and the launch screen can count
 * who joined. A lapsed pending row stays too: `list` hides it and the cap in
 * `create` does not count it.
 *
 * NO REFUSAL NAMES THE PINNED ADDRESS. "This invitation is for a different
 * email address" tells the holder only that this account is not the one.
 */

const MAX_INVITES_PER_ORG = 100;
const MAX_NAME = 80;
const MAX_MESSAGE = 500;

const REFUSALS = {
  INVITE_INVALID: "That invitation is no longer valid.",
  INVITE_REVOKED:
    "This invitation was withdrawn. Ask the person who sent it for a new one.",
  INVITE_DECLINED:
    "This invitation was declined. Ask the person who sent it for a new one.",
  INVITE_USED:
    "This invitation has already been used. Log in with the account that accepted it.",
  INVITE_EXPIRED:
    "This invitation has expired. Ask the person who sent it for a new one.",
  INVITE_WRONG_ACCOUNT:
    "This invitation is for a different email address. Log out, then open the link with the invited account.",
} as const satisfies Partial<Record<ErrorCode, string>>;
type Refusal = keyof typeof REFUSALS;

/** What an invitation calls the person who sent it. */
async function nameOf(ctx: QueryCtx | MutationCtx, userId: string) {
  const profile = await profileOf(ctx, userId);
  if (profile?.displayName) return profile.displayName;
  const user = await authComponent.getAnyUserById(ctx, userId);
  return user?.name || user?.email || "Someone";
}

async function byToken(ctx: QueryCtx | MutationCtx, token: string) {
  return await ctx.db
    .query("orgInvites")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

/**
 * Why `userId` may not use this invitation, or its workspace when they may.
 * The order matters: a finished row says what finished it before anything
 * else, so a used link reads "already used" even to the wrong account.
 */
async function refusalOf(
  ctx: QueryCtx | MutationCtx,
  invite: Doc<"orgInvites">,
  userId: string,
): Promise<
  { refusal: Refusal; org: null } | { refusal: null; org: Doc<"orgs"> }
> {
  const no = (refusal: Refusal) => ({ refusal, org: null });
  if (invite.status === "revoked") return no("INVITE_REVOKED");
  if (invite.status === "declined") return no("INVITE_DECLINED");
  if (invite.status === "accepted") return no("INVITE_USED");
  if (invite.expiresAt <= Date.now()) return no("INVITE_EXPIRED");

  const org = await ctx.db.get(invite.orgId);
  const role = await ctx.db.get(invite.roleId);
  // Fails closed: a link pinned to a role that has since gone grants nothing.
  if (!org || !role || role.orgId !== invite.orgId) {
    return no("INVITE_INVALID");
  }

  // Read from the auth component's own row, not the JWT: the claims are
  // whatever the token was minted with. A matching address is enough; a
  // verified one is not required (spec 5).
  if (invite.email) {
    const user = await authComponent.getAnyUserById(ctx, userId);
    if (user?.email?.trim().toLowerCase() !== invite.email) {
      return no("INVITE_WRONG_ACCOUNT");
    }
  }
  return { refusal: null, org };
}

/**
 * The invitation and its workspace, or a refusal with its own code. Somebody
 * already seated there is refused too: a link does nothing for them, and must
 * not be spent by them.
 */
async function usableInvite(ctx: MutationCtx, token: string, userId: string) {
  const invite = await byToken(ctx, token);
  if (!invite) throwUserError("INVITE_INVALID", REFUSALS.INVITE_INVALID);
  const { refusal, org } = await refusalOf(ctx, invite, userId);
  if (refusal) throwUserError(refusal, REFUSALS[refusal]);
  if (await findSeat(ctx, userId, invite.orgId)) {
    throwUserError("ALREADY_A_MEMBER", "You are already in this workspace.");
  }
  return { invite, org };
}

const inviteValidator = v.object({
  _id: v.id("orgInvites"),
  token: v.string(),
  email: v.union(v.string(), v.null()),
  name: v.union(v.string(), v.null()),
  status: literals("pending", "accepted", "declined"),
  roleId: v.id("orgRoles"),
  roleName: v.string(),
  expiresAt: v.number(),
});

/** Invitations and what became of them. Gated, because the token is in the answer. */
export const list = orgQuery("members:manage")({
  args: {},
  returns: v.array(inviteValidator),
  handler: async (ctx) => {
    // One bounded read per status, newest first, so old answered rows can
    // never push a live one out of a shared window. Revoked is never shown.
    // ponytail: each status shows its newest N. Page it if a workspace ever
    // needs to see further back.
    const newest = async (
      status: "pending" | "accepted" | "declined",
      limit: number,
    ) =>
      (
        await ctx.db
          .query("orgInvites")
          .withIndex("by_org_and_status", (q) =>
            q.eq("orgId", ctx.orgId).eq("status", status),
          )
          .order("desc")
          .take(limit)
      ).reverse();
    const pending = await newest("pending", MAX_INVITES_PER_ORG);
    const accepted = await newest("accepted", MAX_MEMBERS_PER_ORG);
    const declined = await newest("declined", MAX_INVITES_PER_ORG);

    // Display only: `accept` checks the clock again.
    const now = Date.now();
    const rows = [];
    for (const invite of [...accepted, ...declined, ...pending]) {
      if (invite.status === "revoked") continue;
      if (invite.status === "pending" && invite.expiresAt <= now) continue;
      const role = await ctx.db.get(invite.roleId);
      if (!role) continue;
      rows.push({
        _id: invite._id,
        token: invite.token,
        email: invite.email ?? null,
        name: invite.name ?? null,
        status: invite.status,
        roleId: invite.roleId,
        roleName: role.name,
        expiresAt: invite.expiresAt,
      });
    }
    return rows;
  },
});

export const create = orgMutation("members:manage")({
  args: {
    roleId: v.id("orgRoles"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    message: v.optional(v.string()),
    sprintId: v.optional(v.id("sprints")),
  },
  returns: v.object({
    inviteId: v.id("orgInvites"),
    token: v.string(),
    expiresAt: v.number(),
    /** False when no sending domain is configured. See `lib/orgs/email.ts`. */
    emailed: v.boolean(),
  }),
  handler: async (ctx, { roleId, email, name, message, sprintId }) => {
    // Before any write, so a refusal costs nothing.
    await reserveRateLimit(ctx, "orgInvite", ctx.userId);

    const role = await ctx.db.get(roleId);
    if (!role || role.orgId !== ctx.orgId) {
      throwUserError("NOT_FOUND", "That role no longer exists.");
    }
    // Ownership is handed over deliberately, never by a link.
    if (role.kind === "owner") {
      throwUserError(
        "FORBIDDEN",
        "Ownership cannot be given away with an invitation link.",
      );
    }
    requireWithin(permissionsOf(role), ctx);

    const who = name?.trim() || undefined;
    const note = message?.trim() || undefined;
    if (who && who.length > MAX_NAME) {
      throwUserError(
        "FIELD_REQUIRED",
        `A name can be at most ${MAX_NAME} characters.`,
      );
    }
    if (note && note.length > MAX_MESSAGE) {
      throwUserError(
        "FIELD_REQUIRED",
        `A message can be at most ${MAX_MESSAGE} characters.`,
      );
    }
    if (sprintId) {
      const sprint = await ctx.db.get(sprintId);
      if (!sprint || sprint.orgId !== ctx.orgId) {
        throwUserError("NOT_FOUND", "That sprint no longer exists.");
      }
    }

    const now = Date.now();

    // The cap counts live pending invitations only. Lapsed ones stay in the
    // table (spec 5) but `list` hides them, so counting them would brick
    // `create` with nothing visible to revoke. Newest first, because the
    // lapsed ones are the old ones.
    // ponytail: a resent old invitation outside this window goes uncounted,
    // so the cap can run over by the number resent. Index on `expiresAt` if
    // it ever has to be exact.
    const pending = await ctx.db
      .query("orgInvites")
      .withIndex("by_org_and_status", (q) =>
        q.eq("orgId", ctx.orgId).eq("status", "pending"),
      )
      .order("desc")
      .take(MAX_INVITES_PER_ORG);
    const live = pending.filter((row) => row.expiresAt > now).length;
    if (live >= MAX_INVITES_PER_ORG) {
      throwUserError(
        "FIELD_REQUIRED",
        "There are too many invitations open. Revoke some first.",
      );
    }

    const token = mintToken();
    const to = email?.trim().toLowerCase() || undefined;
    const inviteId = await ctx.db.insert("orgInvites", {
      orgId: ctx.orgId,
      roleId,
      token,
      email: to,
      name: who,
      sprintId,
      message: note,
      status: "pending",
      invitedBy: ctx.userId,
      expiresAt: now + INVITE_WINDOW_MS,
      createdAt: now,
    });

    // Only when an address was named. A shareable link has nowhere to go.
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
      if (emailed) await ctx.db.patch(inviteId, { sentAt: now });
    }

    return { inviteId, token, expiresAt: now + INVITE_WINDOW_MS, emailed };
  },
});

/**
 * Send a pinned, pending invitation again, and give it a fresh week: the
 * email says "expires in seven days", and an email wrong about its own link is
 * worse than none.
 */
export const resend = orgMutation("members:manage")({
  args: { inviteId: v.id("orgInvites") },
  returns: v.object({ emailed: v.boolean() }),
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.orgId !== ctx.orgId || invite.status !== "pending") {
      throwUserError("NOT_FOUND", "That invitation is no longer open.");
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

    const now = Date.now();
    await ctx.db.patch(invite._id, { expiresAt: now + INVITE_WINDOW_MS });
    const org = await ctx.db.get(ctx.orgId);
    const emailed = await sendInvite(ctx, {
      to: invite.email,
      orgName: org?.name ?? "a workspace",
      roleName: role.name,
      inviterName: await nameOf(ctx, ctx.userId),
      token: invite.token,
    });
    if (emailed) await ctx.db.patch(invite._id, { sentAt: now });
    return { emailed };
  },
});

/** Withdraw a pending invitation. Anything already answered is left as it is. */
export const revoke = orgMutation("members:manage")({
  args: { inviteId: v.id("orgInvites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }): Promise<null> => {
    const invite = await ctx.db.get(inviteId);
    // Already withdrawn is not an error: revoking twice is a double tap.
    if (invite && invite.orgId === ctx.orgId && invite.status === "pending") {
      await ctx.db.patch(invite._id, { status: "revoked" });
    }
    return null;
  },
});

/** What the signed-out invitation page may show. Pending links only; never the address. */
export const publicPreview = publicQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      orgName: v.string(),
      orgImageUrl: v.union(v.string(), v.null()),
      emailPinned: v.boolean(),
      invitedBy: v.string(),
      name: v.union(v.string(), v.null()),
      message: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { token }) => {
    const invite = await byToken(ctx, token);
    if (!invite || invite.status !== "pending") return null;
    // Display only: `accept` checks the clock again.
    if (invite.expiresAt <= Date.now()) return null;
    const org = await ctx.db.get(invite.orgId);
    if (!org) return null;
    return {
      orgName: org.name,
      orgImageUrl: org.imageId ? await ctx.storage.getUrl(org.imageId) : null,
      emailPinned: invite.email !== undefined,
      invitedBy: await nameOf(ctx, invite.invitedBy),
      name: invite.name ?? null,
      message: invite.message ?? null,
    };
  },
});

/** What each finished or mismatched link shows. INVALID and EXPIRED show nothing. */
const STATE_OF_REFUSAL = {
  INVITE_WRONG_ACCOUNT: "WRONG_ACCOUNT",
  INVITE_REVOKED: "REVOKED",
  INVITE_DECLINED: "DECLINED",
  INVITE_USED: "USED",
} as const;

/**
 * What a link will do before anybody presses Join, so the page can say what
 * to do instead of letting `accept` fail. Null for a link with nothing to
 * show (unknown, expired, or its role gone).
 */
export const preview = authenticatedQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      orgName: v.string(),
      roleName: v.string(),
      invitedBy: v.string(),
      acceptState: literals(
        "READY",
        "WRONG_ACCOUNT",
        "ALREADY_MEMBER",
        "REVOKED",
        "DECLINED",
        "USED",
      ),
      emailConfigured: v.boolean(),
    }),
  ),
  handler: async (ctx, { token }) => {
    const invite = await byToken(ctx, token);
    if (!invite) return null;
    // Display only (its clock read included): `accept` checks again.
    const { refusal } = await refusalOf(ctx, invite, ctx.userId);
    if (refusal === "INVITE_INVALID" || refusal === "INVITE_EXPIRED") {
      return null;
    }
    const org = await ctx.db.get(invite.orgId);
    const role = await ctx.db.get(invite.roleId);
    if (!org || !role) return null;

    const seated = await findSeat(ctx, ctx.userId, invite.orgId);
    return {
      orgName: org.name,
      roleName: role.name,
      invitedBy: await nameOf(ctx, invite.invitedBy),
      acceptState: refusal
        ? STATE_OF_REFUSAL[refusal]
        : seated
          ? ("ALREADY_MEMBER" as const)
          : ("READY" as const),
      emailConfigured: emailConfigured(),
    };
  },
});

/**
 * Take up an invitation.
 *
 * INSERT ONLY, and that is a security property. If this patched an existing
 * seat's role, any link would be a self-demotion primitive: an owner opens a
 * member link and is demoted out of their own workspace. So somebody already
 * seated is refused with ALREADY_A_MEMBER and nothing is written.
 *
 * One mutation, so one transaction: the token read is in the read set, which
 * makes two simultaneous accepts of the same link safe without a lock.
 */
export const accept = authenticatedMutation({
  args: { token: v.string() },
  returns: v.object({ slug: v.string(), orgId: v.id("orgs") }),
  handler: async (
    ctx,
    { token },
  ): Promise<{ slug: string; orgId: Id<"orgs"> }> => {
    const { invite, org } = await usableInvite(ctx, token, ctx.userId);
    // The only door into a workspace, so the only place the ceilings are held.
    await assertCanJoin(ctx, ctx.userId, invite.orgId);

    const person = await insertPerson(
      ctx,
      ctx.userId,
      invite.orgId,
      invite.roleId,
    );
    await ctx.db.patch(invite._id, {
      status: "accepted",
      personId: person._id,
      respondedAt: Date.now(),
    });
    await setActiveOrgOf(ctx, ctx.userId, invite.orgId);
    return { slug: org.slug, orgId: invite.orgId };
  },
});

/**
 * Say no. Held to the same rules as `accept`: a pinned link only by its
 * address, and never by somebody already seated, so an open link cannot be
 * spent by a member or the owner before the person it was meant for opens it.
 */
export const decline = authenticatedMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }): Promise<null> => {
    const { invite } = await usableInvite(ctx, token, ctx.userId);
    await ctx.db.patch(invite._id, {
      status: "declined",
      respondedAt: Date.now(),
    });
    return null;
  },
});
