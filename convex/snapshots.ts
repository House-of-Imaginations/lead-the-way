import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { nowFor } from "./lib/clock";
import {
  takeDueSnapshots,
  takeOutcomes as writeOutcomes,
} from "./lib/snapshots";
import { closesAt } from "./lib/sprintTime";

/**
 * Scheduled by `sprints.launch` at each week's hour end, for a workspace on
 * real time (Ruling 2). Takes every week of its own sprint that is due and
 * missing, not only its own week, and never another sprint's. Once the
 * sprint has closed it schedules the outcomes row as a run of its own, so a
 * throw there can't lose week 4's row (GB-M1).
 */
export const take = internalMutation({
  args: { orgId: v.id("orgs"), sprintId: v.id("sprints") },
  returns: v.null(),
  handler: async (ctx, { orgId, sprintId }): Promise<null> => {
    const org = await ctx.db.get(orgId);
    // Deleted since launch: nothing to take. A gone sprint is checked inside.
    if (org) {
      const sprint = await ctx.db.get(sprintId);
      const now = nowFor(org);
      await takeDueSnapshots(ctx, org, sprint, now);
      if (sprint && closesAt(sprint) <= now) {
        await ctx.scheduler.runAfter(0, internal.snapshots.takeOutcomes, {
          sprintId,
        });
      }
    }
    return null;
  },
});

/**
 * The sprint's one outcomes row (P7a Rulings 9 and 10), scheduled by `take`
 * once the sprint has closed. Re-reads the sprint and its org; the writer
 * checks the sprint is launched, closed and still its org's, and writes
 * nothing when the row exists.
 */
export const takeOutcomes = internalMutation({
  args: { sprintId: v.id("sprints") },
  returns: v.null(),
  handler: async (ctx, { sprintId }): Promise<null> => {
    const sprint = await ctx.db.get(sprintId);
    const org = sprint && (await ctx.db.get(sprint.orgId));
    if (org) await writeOutcomes(ctx, org, sprint, nowFor(org));
    return null;
  },
});
