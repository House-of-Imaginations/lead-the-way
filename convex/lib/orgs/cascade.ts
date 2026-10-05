import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Every product table. Each carries `orgId` and a `by_org` index on it, so a
 * workspace is cleared by one loop. `tests/convex/schema.test.ts` fails when a
 * table is added to the schema and not here, or to the org layer below.
 */
export const ORG_TABLES = [
  "teams",
  "sprints",
  "pathwayProgress",
  "agreements",
  "agreementSignatures",
  "learningProgress",
  "projects",
  "badges",
  "surveyResponses",
  "settings",
  "events",
  "teamSnapshots",
  "sprintOutcomes",
  "demoScript",
] as const;

/**
 * Erase a workspace and everything filed under it: its rows, its people and
 * invitations, its roles, and the files its projects and picture point at.
 */
export async function deleteOrg(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
): Promise<void> {
  // ponytail: one-transaction delete, fine at prototype scale; batch with .take(n) and reschedule past ~4k rows
  for (const table of ORG_TABLES) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const row of rows) {
      // A screenshot is storage nobody can find again once its row is gone.
      if (table === "projects" && "screenshotId" in row && row.screenshotId) {
        await ctx.storage.delete(row.screenshotId);
      }
      await ctx.db.delete(row._id);
    }
  }

  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of people) await ctx.db.delete(row._id);

  const invites = await ctx.db
    .query("orgInvites")
    .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of invites) await ctx.db.delete(row._id);

  const roles = await ctx.db
    .query("orgRoles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const row of roles) await ctx.db.delete(row._id);

  // The picture last, and only after the row that points at it is read: an
  // orphaned file is a wasted megabyte, an orphaned pointer is a broken image.
  const org = await ctx.db.get(orgId);
  await ctx.db.delete(orgId);
  if (org?.imageId) await ctx.storage.delete(org.imageId);
}
