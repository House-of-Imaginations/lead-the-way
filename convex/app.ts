import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Feature flags, named once. Each maps to a Convex env var and is on only when
 * that var is exactly "on", so unset means off and flipping one needs no
 * deploy: `npx convex env set APP_CLOSED on`.
 *
 * A flag has no reach of its own. Its blast radius is wherever `assertFlag`
 * sits:
 * - the builders in `convex/lib/customFunctions.ts`: every public function;
 * - the top of one handler: that function only;
 * - `flagOn` in `src/lib/flags.ts`: a page, a route (`src/proxy.ts`) or a button.
 * Put the assertion on the server for anything that must actually be refused;
 * the frontend check only decides what to show.
 *
 * Add a flag here and nowhere else. Every value is readable by anyone through
 * `flag` below, so never register something secret.
 */
export const FLAGS = {
  /** The kill switch: only the landing page, no auth, no public function. */
  closed: "APP_CLOSED",
  /**
   * Who-is-here heartbeats (`convex/presence.ts`). Off, and unset means off:
   * nothing in `src/` calls them yet, and a heartbeat every ten seconds that
   * no surface reads is pure write load. Turn it on in the same commit as the
   * first avatar stack, never before.
   */
  presence: "PRESENCE",
} as const;

export type Flag = keyof typeof FLAGS;

/** Read per call, never at module scope, so a changed env var applies at once. */
export const flagOn = (flag: Flag) => process.env[FLAGS[flag]] === "on";

/** Refuse unless `flag` is `want`: `assertFlag("closed", false)` means "must be open". */
export function assertFlag(flag: Flag, want: boolean) {
  if (flagOn(flag) !== want)
    throw new ConvexError({
      code: "FEATURE_UNAVAILABLE",
      flag,
      message: "This isn't available right now.",
    });
}

/**
 * A plain `query`: the public builders refuse while the app is closed, and the
 * frontend needs the answer exactly then. Only registered flags are readable,
 * never an arbitrary env var; an unknown name is off.
 */
export const flag = query({
  args: { flag: v.string() },
  returns: v.boolean(),
  handler: async (_ctx, args) =>
    Object.hasOwn(FLAGS, args.flag) && flagOn(args.flag as Flag),
});
