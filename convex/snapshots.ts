import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { nowFor } from "./lib/clock";
import { takeDueSnapshots } from "./lib/snapshots";

/**
 * Scheduled by `sprints.launch` at each week's hour end, for a real workspace
 * only (Ruling 2). Takes every week that is due and missing, not only its own.
 */
export const take = internalMutation({
  args: { orgId: v.id("orgs") },
  returns: v.null(),
  handler: async (ctx, { orgId }): Promise<null> => {
    const org = await ctx.db.get(orgId);
    // Deleted since launch: nothing to take.
    if (org) await takeDueSnapshots(ctx, org, nowFor(org));
    return null;
  },
});
