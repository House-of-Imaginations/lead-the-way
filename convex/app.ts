import { ConvexError } from "convex/values";

/**
 * Feature flags, named once. Each maps to a Convex env var and is on only when
 * that var is exactly "on", so unset means off and flipping one needs no
 * deploy: `npx convex env set APP_CLOSED on`.
 *
 * A flag has no reach of its own. Its blast radius is wherever `assertFlag`
 * sits:
 * - the builders in `convex/lib/customFunctions.ts`: every public function;
 * - the top of one handler: that function only.
 * The frontend never reads a flag directly. A closed app reaches it as the
 * FEATURE_UNAVAILABLE refusal, which `openOrHome` (`src/lib/account/queries.ts`)
 * turns into "/"; DEMO_MODE reaches it through what queries return
 * (`viewer.shell.isDemo`, `demo.personaPassword`).
 *
 * Add a flag here and nowhere else.
 */
export const FLAGS = {
  /** The kill switch: only the landing page, no auth, no public function. */
  closed: "APP_CLOSED",
  /**
   * Demo controls: seeded accounts, persona switch, demo clock and reset. They
   * only ever act on the demo workspace (`orgs.isDemo`), never on a real one.
   */
  demo: "DEMO_MODE",
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
