import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { flagOn } from "../../app";
import { authComponent } from "../../auth";
import { ensureProfile } from "../account/ensureProfile";
import { isDemoAddress } from "../demo/cast";

export const DEFAULT_TIME_ZONE = "Australia/Melbourne";

/** The first word of a name, whatever whitespace surrounds it ("" for none). */
export const firstNameOf = (name: string): string =>
  name.trim().split(/\s+/)[0] ?? "";

/** Two letters for an avatar: the first and last word of a name. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0] ?? "";
  const last = words.length > 1 ? (words.at(-1) ?? "") : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/**
 * Who runs the workspace, by name: the earliest-seated holder of the owner
 * role. 18's tag, the shell's "Managed by" and 19 read it. No number is ever
 * put beside it. ponytail: one name; P7b-3's Members tab lists every owner.
 */
export async function ownerOf(ctx: QueryCtx, orgId: Id<"orgs">) {
  // ponytail: a workspace holds a handful of roles; 100 is the ceiling.
  const roles = await ctx.db
    .query("orgRoles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(100);
  const owner = roles.find((role) => role.kind === "owner");
  if (!owner) return null;
  const person = await ctx.db
    .query("people")
    .withIndex("by_role", (q) => q.eq("roleId", owner._id))
    .first();
  return person && { name: person.name, firstName: firstNameOf(person.name) };
}

/**
 * Seat somebody in a workspace. The only insert into `people`.
 *
 * Callers have done their own checks (`assertCanJoin`, the invitation rules).
 * The name is the account's display name; the email is the auth account's own
 * address, lowercased, or "" when the account has none. `at` is the
 * workspace's clock (`nowFor(org)`), so a demo seat joins in demo time.
 *
 * NOT IN `membership.ts`, ON PURPOSE. This reads the auth component, and
 * `membership.ts` is imported by `customFunctions.ts`, which `auth.ts` imports.
 * Importing `auth.ts` from there makes a module cycle that fails at load time.
 */
export async function insertPerson(
  ctx: MutationCtx,
  userId: string,
  orgId: Id<"orgs">,
  roleId: Id<"orgRoles">,
  at: number,
  jobTitle = "",
): Promise<Doc<"people">> {
  const profile = await ensureProfile(ctx, userId);
  const user = await authComponent.getAnyUserById(ctx, userId);
  const id = await ctx.db.insert("people", {
    userId,
    orgId,
    roleId,
    name: profile.displayName,
    initials: initialsOf(profile.displayName),
    email: user?.email?.trim().toLowerCase() ?? "",
    jobTitle,
    timeZone: DEFAULT_TIME_ZONE,
    createdAt: at,
  });
  const person = await ctx.db.get(id);
  if (!person) throw new Error("just-inserted person is missing");
  return person;
}

/**
 * A shared demo persona, while the demo is on. Such an account stays in the
 * demo workspace: it neither makes a workspace nor joins a real one. Read from
 * the auth component's own row, as `invites.ts` reads a pinned address.
 */
export async function isDemoAccount(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<boolean> {
  if (!flagOn("demo")) return false;
  const user = await authComponent.getAnyUserById(ctx, userId);
  return user ? isDemoAddress(user.email) : false;
}
