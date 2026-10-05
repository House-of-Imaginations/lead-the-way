import type { SystemDataModel } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Wall-clock minutes, because `_storage` stamps the upload in real time.
const FRESH_MS = 15 * 60_000;

/**
 * Is this upload a new file nobody else holds? Storage ids carry no owner and
 * leak through `storage.getUrl` URLs (a workspace logo is served to every
 * member, even on the signed-out invite), so a mutation that adopts an id and
 * later deletes it must refuse a stale one or one another row already points
 * at. Taking someone else's file would let "replace" or "remove" delete it.
 *
 * `ownerOf` names the row allowed to hold it already (the caller's own org or
 * project). It covers every `v.id("_storage")` field in the schema:
 * `orgs.imageId` and `projects.screenshotId`. Add a field, add a check here.
 *
 * Returns false rather than throwing, so each caller keeps its own error code.
 * Call it before any patch or delete.
 */
export async function isAdoptable(
  ctx: QueryCtx,
  uploaded: SystemDataModel["_storage"]["document"],
  ownerOf: { orgId?: Id<"orgs">; projectId?: Id<"projects"> },
): Promise<boolean> {
  // Date.now(), not viewer.now: the upload is on the wall clock, and the demo
  // clock is weeks behind it.
  if (Date.now() - uploaded._creationTime > FRESH_MS) return false;
  const storageId = uploaded._id;
  const logo = await ctx.db
    .query("orgs")
    .withIndex("by_imageId", (q) => q.eq("imageId", storageId))
    .first();
  const holder = await ctx.db
    .query("projects")
    .withIndex("by_screenshotId", (q) => q.eq("screenshotId", storageId))
    .first();
  return (
    (!logo || logo._id === ownerOf.orgId) &&
    (!holder || holder._id === ownerOf.projectId)
  );
}
