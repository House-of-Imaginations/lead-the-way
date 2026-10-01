import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { nowFor } from "./lib/clock";
import { takeDueSnapshots } from "./lib/snapshots";

/**
 * Scheduled by `sprints.launch` at each week's hour end, for a workspace on
 * real time (Ruling 2). Takes every week of its own sprint that is due and
 * missing, not only its own week, and never another sprint's.
 */
export const take = internalMutation({
  args: { orgId: v.id("orgs"), sprintId: v.id("sprints") },
  returns: v.null(),
  handler: async (ctx, { orgId, sprintId }): Promise<null> => {
    const org = await ctx.db.get(orgId);
    // Deleted since launch: nothing to take. A gone sprint is checked inside.
    if (org) {
      const sprint = await ctx.db.get(sprintId);
      await takeDueSnapshots(ctx, org, sprint, nowFor(org));
    }
    return null;
  },
});
