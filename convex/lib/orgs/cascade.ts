import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Erase a workspace and everything filed under it.
 *
 * Bounded reads, but NOT bounded work: a workspace at the member ceiling is a
 * few hundred rows across three tables, which is well inside one transaction.
 * The ceilings in `members.ts`, `orgRoles.ts` and `invites.ts` are what make
 * that true, so raising any of them means revisiting this.
 */
export async function deleteOrg(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
): Promise<void> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of memberships) await ctx.db.delete(row._id);

  const invites = await ctx.db
    .query("orgInvites")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of invites) await ctx.db.delete(row._id);

  const roles = await ctx.db
    .query("orgRoles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of roles) await ctx.db.delete(row._id);

  // The picture last, and only after the row that points at it is read: an
  // orphaned file is a wasted megabyte, an orphaned pointer is a broken image
  // on every screen that draws the workspace.
  const org = await ctx.db.get(orgId);
  await ctx.db.delete(orgId);
  if (org?.imageId) await ctx.storage.delete(org.imageId);
}
