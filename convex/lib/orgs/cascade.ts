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
  "reminders",
  "events",
  "teamSnapshots",
  "sprintOutcomes",
  "demoScript",
] as const;

/**
 * Every career table (D12): keyed by `userId`, never `orgId`, so a workspace
 * deletion never touches them. P12a lists each new career table here.
 */
export const CAREER_TABLES = ["careerProfiles"] as const;

/**
 * What removing a member (`dropSeat`) does to each table holding a person id
 * (M-c). Dropped rows go with the seat. Kept rows stay, orphaned, and their
 * readers must survive a missing person, as each note says.
 * `tests/convex/schema.test.ts` fails when a table gains a person id and
 * isn't listed here.
 */
export const ON_REMOVE = {
  settings: "dropped",
  reminders: "dropped",
  // Private: only the holder ever reads them.
  pathwayProgress: "kept",
  learningProgress: "kept",
  // Live totals count seated people only (`loadCountable`).
  surveyResponses: "kept",
  // 14's board drops a project whose owner left (`showAndTell.ts`).
  projects: "kept",
  // The public link reads the stored `holderName` and `holderTimeZone`.
  badges: "kept",
  // A contact who left reads as none on 06 and as the manager on 10.
  agreements: "kept",
  // The live signature count counts seated people only (`lib/agreement.ts`).
  agreementSignatures: "kept",
  // Stored cohorts: a new `seated` hides the rest of the sprint (Ruling FX).
  teamSnapshots: "kept",
  sprintOutcomes: "kept",
  // History. Sprint 1's joined counts only seats that still exist.
  orgInvites: "kept",
} as const satisfies Record<string, "dropped" | "kept">;

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
