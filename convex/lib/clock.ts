import type { Doc } from "../_generated/dataModel";
import { flagOn } from "../app";

/**
 * "Now" for a workspace: the demo clock in the demo while DEMO_MODE is on,
 * real time everywhere else. Anything that decides which week it is or when
 * the next protected hour falls calls this, never `Date.now()`.
 *
 * ponytail: a real workspace reads `Date.now()`, in queries too, so a query's
 * answer can go stale across a time boundary (a new week, the hour starting)
 * until something else makes it re-run. Mutations check the time again, so
 * nothing is decided on a stale answer. The demo reads the stored `demoNow`,
 * which a clock move patches, so it isn't affected. If a stale screen ever
 * matters, pass `now` in from the client or flip a flag field on a schedule.
 */
export function nowFor(org: Pick<Doc<"orgs">, "isDemo" | "demoNow">): number {
  return org.isDemo && org.demoNow !== undefined && flagOn("demo")
    ? org.demoNow
    : Date.now();
}
