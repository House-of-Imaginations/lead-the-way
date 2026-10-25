import { v } from "convex/values";
import { assertFlag, flagOn } from "./app";
import {
  authenticatedMutation,
  publicQuery,
  viewerMutation,
} from "./lib/customFunctions";
import { insertCareerProfile, logCareerEvent } from "./lib/careers/writers";
import {
  DEMO_SLUG,
  demoAccounts,
  writeCalderLane,
} from "./lib/demo/calderLane";
import { ACCOUNT_HOLDERS, castOf, demoUserId } from "./lib/demo/cast";
import { moveClock } from "./lib/demo/moveClock";
import {
  careerTargetValidator,
  moveCareerClock as moveCareers,
  writePivotCrews,
} from "./lib/demo/pivotCrews";
import { isDemoAccount } from "./lib/orgs/people";
import { DEMO_TARGETS, demoTargetValidator } from "./lib/demo/schedule";
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
 * the workspace's product rows, including the tester's, don't. One reset
 * rewrites both tracks (spec 11.2): every career row, Dan's included, goes
 * and the careers demo is written fresh.
 */
export const reset = viewerMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    demoOrgOf(ctx.viewer);
    await writeCalderLane(ctx, await demoAccounts(ctx));
    await writePivotCrews(ctx);
    return null;
  },
});

/** DEMO_MODE on and a demo account: the careers controls' gate (spec 7), not a seat. */
async function assertCareerDemo(
  ctx: Parameters<typeof isDemoAccount>[0],
  userId: string,
) {
  assertFlag("demo", true);
  if (!(await isDemoAccount(ctx, userId))) {
    throwUserError("FORBIDDEN", "Only a demo account can do that.");
  }
}

/**
 * `reset` for the master and careers guides (P14b): the same writes, gated
 * on a demo account rather than a Calder Lane seat, since Amara and Lena
 * hold none. NO PERMISSION CHECK, ON PURPOSE, as with `reset`.
 */
export const resetAll = authenticatedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await assertCareerDemo(ctx, ctx.userId);
    await writeCalderLane(ctx, await demoAccounts(ctx));
    await writePivotCrews(ctx);
    return null;
  },
});

/** Dan's contact address for the guide shortcut (spec 7). */
const DAN_CONTACT = "dan@pivotcrews.example";

/**
 * Get Dan ready before the guide signs in as him (D4): his seat starts on
 * 8 September, so a team clock before week 1 jumps there. With
 * `privateTrack`, he also gets the private Change careers track MS3 would
 * make, with a seeded Business Analyst map, unless he has a track already.
 * NO PERMISSION CHECK, ON PURPOSE: any demo account may, as with `resetAll`.
 */
export const prepareDan = authenticatedMutation({
  args: { privateTrack: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { privateTrack }): Promise<null> => {
    await assertCareerDemo(ctx, ctx.userId);
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG))
      .unique();
    if (!org?.isDemo) {
      throwUserError("DEMO_NOT_SEEDED", "Reset the demo, then try again.");
    }
    if ((org.demoNow ?? 0) < DEMO_TARGETS.week1)
      await moveClock(ctx, org, "week1");
    if (!privateTrack) return null;

    const dan = castOf("dan");
    const userId = await demoUserId(ctx, dan.email);
    if (!userId) {
      throwUserError("DEMO_NOT_SEEDED", "Reset the demo, then try again.");
    }
    const existing = await ctx.db
      .query("careerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return null;
    // Seeded with the careers demo, so it is there whenever Dan is.
    const at = (await ctx.db.query("careerDemo").first())?.now;
    if (at === undefined) {
      throwUserError("DEMO_NOT_SEEDED", "Reset the demo, then try again.");
    }
    // What `tracks.startPrivate` writes, with the map MS3 would bring.
    await insertCareerProfile(ctx, {
      userId,
      firstName: dan.name.split(" ")[0]!,
      private: true,
      contactEmail: DAN_CONTACT,
      currentRole: dan.jobTitle,
      targetRole: "business-analyst",
      hoursPerWeek: 2,
      consentAt: at,
    });
    await logCareerEvent(ctx, { name: "privateTrackStarted", at });
    return null;
  },
});

/**
 * Move the careers clock forward (week1, week2, week3, proof) or simulate a
 * missed week (plan A4). NO PERMISSION CHECK, ON PURPOSE, as with `setClock`:
 * any demo account may, Amara as much as Dan. It never moves backwards; only
 * a reset goes back. Its UI is P14b.
 */
export const moveCareerClock = authenticatedMutation({
  args: { target: careerTargetValidator },
  returns: v.object({ now: v.number(), missedWeek: v.boolean() }),
  handler: async (ctx, { target }) => {
    await assertCareerDemo(ctx, ctx.userId);
    return await moveCareers(ctx, target);
  },
});

/**
 * The careers clock and event counts for the guide (spec 7). Separate from
 * `status`, which stays byte-identical (X2). Null with DEMO_MODE off, signed
 * out, or for an account that isn't a demo one. Counts are raw, by event
 * name, as `status`'s are (G-f): `careerEvents` holds no person id (P10).
 */
export const careerStatus = publicQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      now: v.union(v.null(), v.number()),
      missedWeek: v.boolean(),
      counts: v.array(v.object({ name: v.string(), count: v.number() })),
    }),
  ),
  handler: async (ctx) => {
    if (!flagOn("demo") || ctx.userId === null) return null;
    if (!(await isDemoAccount(ctx, ctx.userId))) return null;
    // The stored clock, not a read of it (Ruling 16), as `status` does.
    const { now, missedWeek } = (await ctx.db.query("careerDemo").first()) ?? {
      now: null,
      missedWeek: false,
    };
    const events = await ctx.db.query("careerEvents").take(MAX_DEMO_EVENTS);
    const counts = new Map<string, number>();
    for (const { name } of events)
      counts.set(name, (counts.get(name) ?? 0) + 1);
    return {
      now: now ?? null,
      missedWeek,
      counts: [...counts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, count })),
    };
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
