import { v } from "convex/values";
import { assertFlag, flagOn } from "./app";
import { publicQuery, viewerMutation } from "./lib/customFunctions";
import { demoAccounts, writeCalderLane } from "./lib/demo/calderLane";
import { ACCOUNT_HOLDERS, castOf } from "./lib/demo/cast";
import { moveClock } from "./lib/demo/moveClock";
import { demoTargetValidator } from "./lib/demo/schedule";
import { throwUserError } from "./lib/errors";
import { getViewer, type Viewer } from "./lib/viewer";
import { EVENT_TYPES, eventTypeValidator } from "./tables/sprint";

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
 * DEMO_MODE is on, and only for a signed-in caller: signed out it answers
 * null rather than throwing, as `status` does, since a page left open after
 * sign-out keeps its subscription. The guide is private (G-a): the tester
 * signs in first. It unlocks only the seeded demo accounts, which the auth
 * hook keeps from being changed (DEMO_ALLOWED in `convex/auth.ts`).
 */
export const personaPassword = publicQuery({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) =>
    (ctx.userId !== null && flagOn("demo") && process.env.DEMO_PASSWORD) ||
    null,
});

/**
 * Who /login offers as a demo account (Task 9). Empty unless DEMO_MODE is on.
 * Signed out on purpose: it lists the seeded cast only, by name, email and
 * role, with no ids and no participation data. Priya is the cast's only
 * Manager (`writeCalderLane`). The sign-in itself happens on the server
 * (`src/app/api/demo/login/route.ts`), which accepts only these emails.
 */
export const loginCast = publicQuery({
  args: {},
  returns: v.array(
    v.object({
      name: v.string(),
      email: v.string(),
      role: v.union(v.literal("Manager"), v.literal("Employee")),
    }),
  ),
  handler: async () =>
    flagOn("demo")
      ? ACCOUNT_HOLDERS.map(({ key, name, email }) => ({
          name,
          email,
          role: key === "priya" ? ("Manager" as const) : ("Employee" as const),
        }))
      : [],
});

// ponytail: a demo workspace sees hundreds of events, not thousands. Past
// this the counts stop growing; count with an aggregate component if a demo
// ever runs that long without a reset.
const MAX_DEMO_EVENTS = 2000;

const PERSONAS = ["priya", "dan"] as const;
const personaValidator = v.union(v.literal("priya"), v.literal("dan"));

/**
 * What the guide and the floating clock show (P9). Null with DEMO_MODE off.
 * `{ demo: null }` for a signed-in account whose open workspace is not the
 * demo, Dan before he joins included: the guide then offers Start as Priya.
 *
 * COUNTS ARE RAW, ON PURPOSE (G-f, the user's ruling of 2026-10-14): every
 * event type's total in the demo workspace, however small, with no names, no
 * ids and no `meta`. The under-threshold rule of manager views does not apply
 * to the demo's own test instrument. Only someone seated in the demo sees them.
 */
export const status = publicQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      demo: v.union(
        v.null(),
        v.object({
          // The viewer's own workspace (already in the shell): live, so the
          // guide's mutations follow a reset made in another tab.
          orgId: v.id("orgs"),
          demoNow: v.number(),
          persona: v.union(v.null(), personaValidator),
          accounts: v.array(
            v.object({
              key: personaValidator,
              name: v.string(),
              email: v.string(),
              jobTitle: v.string(),
            }),
          ),
          counts: v.array(
            v.object({ type: eventTypeValidator, count: v.number() }),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    if (!flagOn("demo")) return null;
    // A page left open after sign-out keeps this subscription; don't throw.
    if (ctx.userId === null) return { demo: null };
    const viewer = await getViewer(ctx);
    if (!viewer?.org.isDemo) return { demo: null };
    const events = await ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", viewer.org._id))
      .take(MAX_DEMO_EVENTS);
    const accounts = PERSONAS.map((key) => {
      const { name, email, jobTitle } = castOf(key);
      return { key, name, email, jobTitle };
    });
    return {
      demo: {
        orgId: viewer.org._id,
        demoNow: viewer.org.demoNow ?? 0, // the stored clock, not a read of it (Ruling 16)
        persona:
          accounts.find((a) => a.email === viewer.person.email)?.key ?? null,
        accounts,
        counts: EVENT_TYPES.map((type) => ({
          type,
          count: events.filter((e) => e.type === type).length,
        })),
      },
    };
  },
});
