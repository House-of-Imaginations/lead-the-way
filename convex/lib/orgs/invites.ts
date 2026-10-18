import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
import { normalEmail } from "../inviteRules";
import { rolesOf } from "./membership";

/**
 * The credential on an invitation link, how long it is good for, and the one
 * insert into `orgInvites`.
 *
 * `mintToken` and the window are pure: this is the half where being quietly
 * wrong costs something, so it is testable without a database.
 */

/**
 * A week. Capped HERE and never taken from the caller.
 *
 * An expiry a client chooses is not an expiry. The window is also what bounds
 * every other risk on this row: a role widened after the link was minted, a
 * link forwarded to somebody it was not meant for, a mailbox later
 * compromised. Seven days is short enough to bound those and long enough that
 * somebody who was on holiday can still use it.
 */
export const INVITE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Live pending invitations a workspace may hold at once. */
export const MAX_INVITES_PER_ORG = 100;

/**
 * Live pending invitations, up to the cap. Lapsed rows are outside the range.
 * `now` is the workspace clock (`nowFor`).
 */
export async function livePending(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  now: number,
) {
  return await ctx.db
    .query("orgInvites")
    .withIndex("by_org_status_and_expiresAt", (q) =>
      q.eq("orgId", orgId).eq("status", "pending").gt("expiresAt", now),
    )
    .take(MAX_INVITES_PER_ORG);
}

/**
 * 256 bits from the platform CSPRNG, base64url so it survives a URL intact.
 *
 * `crypto.randomUUID()` would be 122 bits, which is fine in practice, but this
 * is a bearer credential -- whoever holds it joins the workspace -- and the
 * extra entropy costs nothing. `Math.random()` would be a defect: it is seeded
 * per execution and is not a CSPRNG.
 */
export function mintToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * The one insert into `orgInvites`: `invites.create`, `sprints.launch` and the
 * script's `priya.launch` all write through here (writer contract rule 6, so
 * the address is normalised here, Ruling 4). `at` is the workspace clock and
 * stamps `createdAt`; `expiresAt` is real time, as the window above says.
 */
export async function insertInvite(
  ctx: MutationCtx,
  i: {
    orgId: Id<"orgs">;
    roleId: Id<"orgRoles">;
    email?: string;
    name?: string;
    sprintId?: Id<"sprints">;
    message?: string;
    invitedBy: string;
    at: number;
    sentAt?: number;
  },
): Promise<{ inviteId: Id<"orgInvites">; token: string; expiresAt: number }> {
  const token = mintToken();
  const expiresAt = Date.now() + INVITE_WINDOW_MS;
  const inviteId = await ctx.db.insert("orgInvites", {
    orgId: i.orgId,
    roleId: i.roleId,
    token,
    email: normalEmail(i.email ?? "") || undefined,
    name: i.name,
    sprintId: i.sprintId,
    message: i.message,
    status: "pending",
    invitedBy: i.invitedBy,
    sentAt: i.sentAt,
    expiresAt,
    createdAt: i.at,
  });
  return { inviteId, token, expiresAt };
}

/**
 * The role a team is invited into: the workspace's stored launch role (G-g),
 * or, for a workspace made before P9, a custom role that grants nothing,
 * "Employee" first. A role that grants anything is never picked, even the
 * stored one: it fails closed (R-a keeps that from happening through the
 * app). The owner role is never a candidate. Null when there is none, for a
 * reader that must not throw (`orgRoles`' R-a rules and flags).
 */
export function pickInviteRole(
  org: Pick<Doc<"orgs">, "inviteRoleId">,
  roles: Doc<"orgRoles">[],
): Doc<"orgRoles"> | null {
  const bare = roles.flatMap((r) =>
    r.kind === "custom" && r.permissions.length === 0 ? [r] : [],
  );
  if (org.inviteRoleId) {
    return bare.find((r) => r._id === org.inviteRoleId) ?? null;
  }
  return bare.find((r) => r.name === "Employee") ?? bare[0] ?? null;
}

/** `pickInviteRole` for a writer, which must have one. */
export async function inviteRoleOf(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<Doc<"orgRoles">> {
  const org = await ctx.db.get(orgId);
  const role = org && pickInviteRole(org, await rolesOf(ctx, orgId));
  if (!role) {
    throwUserError(
      "NOT_FOUND",
      "There is no role to invite your team into. Add one in workspace settings first.",
    );
  }
  return role;
}
