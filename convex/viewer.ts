import { v } from "convex/values";
import { publicQuery } from "./lib/customFunctions";
import { homeOf, shellOf, shellValidator } from "./lib/shell";
import { getViewer } from "./lib/viewer";

/**
 * Where this person belongs: null signed out, "/setup/start" with no
 * workspace, else the area home (R4). Signed out on purpose: the proxy sees
 * only a cookie, and a stale cookie must end at /login, not in a loop.
 */
export const home = publicQuery({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    if (!ctx.userId) return null;
    const viewer = await getViewer(ctx);
    return viewer ? await homeOf(ctx, viewer) : "/setup/start";
  },
});

/** Everything the app shell draws (R3). Null signed out or with no workspace. */
export const shell = publicQuery({
  args: {},
  returns: v.union(v.null(), shellValidator),
  handler: async (ctx) => {
    if (!ctx.userId) return null;
    const viewer = await getViewer(ctx);
    return viewer ? await shellOf(ctx, viewer) : null;
  },
});
