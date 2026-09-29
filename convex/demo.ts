import { v } from "convex/values";
import { assertFlag } from "./app";
import { viewerMutation } from "./lib/customFunctions";
import { demoAccounts, writeCalderLane } from "./lib/demo/calderLane";
import { throwUserError } from "./lib/errors";
import type { Viewer } from "./lib/viewer";

/**
 * The demo controls on /guide. Both need DEMO_MODE on and act only on the
 * viewer's own workspace, and only when that workspace is the demo: no
 * argument names a workspace, so no caller can aim these at a real one.
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
