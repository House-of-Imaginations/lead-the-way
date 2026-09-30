import { v } from "convex/values";
import { assertFlag, flagOn } from "./app";
import { authenticatedQuery, viewerMutation } from "./lib/customFunctions";
import { demoAccounts, writeCalderLane } from "./lib/demo/calderLane";
import { moveClock } from "./lib/demo/moveClock";
import { demoTargetValidator } from "./lib/demo/schedule";
import { throwUserError } from "./lib/errors";
import type { Viewer } from "./lib/viewer";

/**
 * The demo controls on /guide: reset, setClock and personaPassword. The two
 * mutations need DEMO_MODE on and act only on the viewer's own workspace, and
 * only when that workspace is the demo. `expectOrgId` only guards (it refuses
 * if the open workspace changed) and never selects one, so no caller can aim
 * these at a real workspace.
 */

function demoOrgOf(viewer: Viewer) {
  assertFlag("demo", true);
  if (!viewer.org.isDemo) {
    throwUserError("FORBIDDEN", "Only the demo workspace can do that.");
  }
  return viewer.org;
}

/**
 * Start the demo again from Tuesday 1 September.
 *
 * NO PERMISSION CHECK, ON PURPOSE. The tester switches personas on /guide, so
 * any persona in the demo workspace (Dan, an Employee, as much as Priya) may
 * reset it. The only gates are DEMO_MODE and `org.isDemo`. Accounts survive;
 * the workspace's product rows, including the tester's, don't.
 */
export const reset = viewerMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    demoOrgOf(ctx.viewer);
    await writeCalderLane(ctx, await demoAccounts(ctx));
    return null;
  },
});

/**
 * Jump the demo clock forward and play every step it passes, in order, once.
 *
 * NO PERMISSION CHECK, ON PURPOSE, as with `reset`: the tester switches
 * personas, so Dan (an Employee) may move the clock as much as Priya. The only
 * gates are DEMO_MODE and `org.isDemo`. The clock never moves backwards; only
 * a reset goes back.
 *
 * One mutation: a step that throws undoes the whole jump, and the `appliedAt`
 * stamp is committed with the step's writes, so no step runs twice. A row
 * whose key no longer exists in `STEPS` (an older deploy) is left unapplied.
 */
export const setClock = viewerMutation()({
  args: { target: demoTargetValidator },
  returns: v.object({ demoNow: v.number(), applied: v.array(v.string()) }),
  handler: async (ctx, { target }) =>
    await moveClock(ctx, demoOrgOf(ctx.viewer), target),
});

/**
 * The shared demo password, for the persona switch (spec 6). Null unless
 * DEMO_MODE is on, and only for a signed-in caller. /guide's "Start as Priya"
 * signs in from nothing; P9 decides how it signs in. It unlocks only the
 * seeded demo accounts, which the auth hook keeps from being changed
 * (DEMO_ALLOWED in `convex/auth.ts`).
 */
export const personaPassword = authenticatedQuery({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async () => (flagOn("demo") && process.env.DEMO_PASSWORD) || null,
});
