import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { authComponent } from "../../auth";
import { ensureProfile } from "../account/ensureProfile";

export const DEFAULT_TIME_ZONE = "Australia/Melbourne";

/** Two letters for an avatar: the first and last word of a name. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0] ?? "";
  const last = words.length > 1 ? (words.at(-1) ?? "") : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
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
