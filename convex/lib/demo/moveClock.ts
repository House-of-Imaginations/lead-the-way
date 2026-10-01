import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { throwUserError } from "../errors";
import { takeDueSnapshots } from "../snapshots";
import { currentSprint } from "../sprint";
import { DEMO_TARGETS, type DemoTarget } from "./schedule";
import { STEPS, isStepKey } from "./script";

/**
 * Jump the demo clock forward and play every step it passes, in order, once,
 * freezing the team totals of each week whose hour has ended as the steps
 * pass it (Ruling 2). Shared by `demo.setClock` (the guide) and `seed.clock`
 * (e2e and local runs). The caller has checked DEMO_MODE and that `org` is
 * the demo.
 */
export async function moveClock(
  ctx: MutationCtx,
  org: Doc<"orgs">,
  target: DemoTarget,
): Promise<{ demoNow: number; applied: string[] }> {
  const to = DEMO_TARGETS[target];
  if (to < (org.demoNow ?? 0)) {
    throwUserError(
      "DEMO_CLOCK_BACKWARDS",
      "The demo clock only moves forward. Reset the demo to start again.",
    );
  }
  await ctx.db.patch(org._id, { demoNow: to });

  // One row per scripted step (22), so the due range fits in one read.
  const due = await ctx.db
    .query("demoScript")
    .withIndex("by_org_and_at", (q) => q.eq("orgId", org._id).lte("at", to))
    .collect();
  const applied: string[] = [];
  for (const row of due) {
    if (row.appliedAt !== undefined || !isStepKey(row.key)) continue;
    // Before a step, every week whose hour ended before it: a jump past
    // several weeks freezes each as of its own hour, not as of the jump. A
    // step at the hour's end (the session) still counts. The sprint is read
    // each time, as a step may launch it.
    await takeDueSnapshots(
      ctx,
      org,
      await currentSprint(ctx, org._id),
      to,
      row.at - 1,
    );
    await STEPS[row.key]({ ctx, orgId: org._id, at: row.at });
    await ctx.db.patch(row._id, { appliedAt: Date.now() });
    applied.push(row.key);
  }
  await takeDueSnapshots(ctx, org, await currentSprint(ctx, org._id), to);
  return { demoNow: to, applied };
}
