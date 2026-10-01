import { literals } from "convex-helpers/validators";
import { v, type Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { dayMonth, latestSaved } from "./lib/agreement";
import { viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { MAX_MEMBERS_PER_ORG, permissionsOf } from "./lib/orgs/membership";
import { PATHWAY_MODULES, coachingPercent } from "./lib/pathway";
import { thresholdOf, type Aggregate } from "./lib/privacy";
import { isManager } from "./lib/shell";
import { latestSnapshot } from "./lib/snapshots";
import {
  currentSprint,
  currentTeam,
  setupGate,
  sprintInvites,
} from "./lib/sprint";
import {
  hourEnd,
  hourLabel,
  hourLong,
  hourStart,
  sprintPhase,
  startDateOf,
  weekOf,
  type SprintPhase,
} from "./lib/sprintTime";

const tagValidator = v.object({
  label: v.string(), // "Active", "Draft", "Scheduled", "Completed", "Saved"
  kind: literals("blue", "green", "gray"),
});
/** One team total on a tile. */
const statValidator = v.union(
  v.object({ kind: v.literal("pending"), helper: v.string() }), // value "Not yet", helper "Updated after Wed 9 Sep, 3:00 PM"
  v.object({ kind: v.literal("hidden"), helper: v.string() }), // value "Hidden", helper "Hidden until 5 responses"
  v.object({ kind: v.literal("shown"), value: v.number(), of: v.number() }), // "6" with suffix "of 7"
);
export const overviewValidator = v.object({
  phase: literals("draft", "scheduled", "active", "complete"),
  /** Holds `sprint:manage`: the header buttons and card links lead to its pages. */
  canManage: v.boolean(),
  /** "Your team is in week 2. The next protected hour is Wednesday 16 September at 2:00 PM." */
  intro: v.string(),
  /** Setup, then one column per week. */
  timeline: v.array(
    v.object({
      label: v.string(), // "Setup, 1 to 8 Sep", "Week 2, 16 Sep (current)"
      state: literals("done", "current", "todo"),
      items: v.array(v.object({ label: v.string(), done: v.boolean() })),
    }),
  ),
  /** The viewer's own coaching path: "Leading AI at Work", "Sprint coaching modules", 65. */
  learning: v.object({
    title: v.string(),
    label: v.string(),
    percent: v.number(),
  }),
  sprint: v.object({
    title: v.string(), // "Week 2 of 4", "Starts 9 Sep", "Sprint complete"
    tag: tagValidator,
    invited: v.number(),
    joined: v.number(),
    /** Null without team:insights. */
    projects: v.union(v.null(), statValidator),
  }),
  agreement: v.object({
    title: v.string(), // "Signed by the team", "Saved", "Not saved yet"
    tag: tagValidator,
    body: v.union(v.null(), v.string()),
  }),
  /** Null before launch (phase "draft") or without team:insights. */
  team: v.union(
    v.null(),
    v.object({
      sessionDone: v.object({ label: v.string(), stat: statValidator }), // "Week 1 session done"
      tasksUnderway: v.object({ label: v.string(), stat: statValidator }), // "Real tasks underway"
    }),
  ),
});
export type Overview = Infer<typeof overviewValidator>;
type Tag = Infer<typeof tagValidator>;
type Stat = Infer<typeof statValidator>;

const DAY = 86_400_000;

const TAGS: Record<SprintPhase, Tag> = {
  draft: { label: "Draft", kind: "gray" },
  scheduled: { label: "Scheduled", kind: "gray" },
  active: { label: "Active", kind: "blue" },
  complete: { label: "Completed", kind: "green" },
};

/** "9 Sep", as its day and month. */
function dayMon(at: number, timeZone: string): [string, string] {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    day: "numeric",
    month: "short",
  }).formatToParts(at)) {
    p[part.type] = part.value;
  }
  return [p.day!, p.month!];
}

/** "1 to 8 Sep", or "31 Aug to 8 Sep" across months. */
function spanShort(from: number, to: number, timeZone: string): string {
  const [d1, m1] = dayMon(from, timeZone);
  const [d2, m2] = dayMon(to, timeZone);
  return m1 === m2 ? `${d1} to ${d2} ${m2}` : `${d1} ${m1} to ${d2} ${m2}`;
}

/** A snapshot's total on a tile: not taken yet, hidden below the threshold, or shown. */
function statOf(
  total: Aggregate | undefined,
  pending: string,
  org: Doc<"orgs">,
): Stat {
  if (!total) return { kind: "pending", helper: pending };
  // Checked again on read: the threshold may have been raised since.
  if (total.hidden || total.n < thresholdOf(org)) {
    return {
      kind: "hidden",
      helper: `Hidden until ${thresholdOf(org)} responses`,
    };
  }
  return { kind: "shown", value: total.value, of: total.n };
}

/**
 * 08, the manager overview. Every label is made here; the page formats only
 * `value` and `of`.
 *
 * Any manager may read it, so /manager never refuses its own home (Ruling 6).
 * Team totals and the projects count need `team:insights`, and come only from
 * the latest weekly snapshot, never a live count (Ruling 1). Invited and
 * joined are live membership facts (Ruling 3). `hour` is never read: the
 * server passes the current hour so the cached answer turns over each hour
 * (Ruling 14).
 */
export const overview = viewerQuery()({
  args: { hour: v.optional(v.number()) },
  returns: v.union(v.null(), overviewValidator),
  handler: async (ctx): Promise<Overview | null> => {
    const { viewer } = ctx;
    if (!isManager(viewer)) {
      throwUserError(
        "FORBIDDEN",
        "Your role in this workspace does not allow that.",
      );
    }
    const org = viewer.org;
    const [team, sprint] = await Promise.all([
      currentTeam(ctx, org._id),
      currentSprint(ctx, org._id),
    ]);
    if (!team || !sprint) return null;
    // `now` is a getter that reads the clock; read it once.
    const now = viewer.now;
    const tz = sprint.timeZone;
    const insights = viewer.permissions.includes("team:insights");
    const launched = sprint.launchedAt !== undefined;
    const phase = sprintPhase(sprint, now);
    // A draft's week one is worked out now (Ruling 17); a launched sprint keeps its own.
    const dated = { ...sprint, startDate: startDateOf(sprint, now) };
    const week = weekOf(dated, now);
    const first = hourStart(dated, 1);
    const last = hourStart(dated, sprint.weeks);
    const pending = `Updated after ${hourLabel(hourEnd(dated, 1), tz)}`;

    // Launch needed all three, so after it they read done, whoever is looking.
    const gate = await setupGate(ctx, viewer, team, sprint);
    const timeline: Overview["timeline"] = [
      {
        label: `Setup, ${spanShort(sprint.createdAt, first - DAY, tz)}`,
        state: launched ? "done" : "current",
        items: [
          { label: "Manager pathway", done: launched || gate.pathwayDone },
          { label: "Team AI Agreement", done: launched || gate.agreementSaved },
          { label: "Invite team", done: launched },
        ],
      },
    ];
    for (let w = 1; w <= sprint.weeks; w++) {
      const current = phase === "active" && week === w;
      // The week we're in stays current until Monday, even after its hour.
      const state =
        phase === "complete" || (!current && hourEnd(dated, w) <= now)
          ? "done"
          : current
            ? "current"
            : "todo";
      timeline.push({
        label: `Week ${w}, ${dayMon(hourStart(dated, w), tz).join(" ")}${current ? " (current)" : ""}`,
        state,
        items: [
          {
            label: w === sprint.weeks ? "Show and tell" : "Learn and apply",
            done: state === "done",
          },
        ],
      });
    }

    let intro = `Your sprint starts ${hourLong(first, tz)}.`;
    if (phase === "complete") {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "long",
      }).format(last);
      intro = `Your sprint finished on ${weekday} ${dayMonth(last, tz)}.`;
    } else if (phase === "active") {
      // The next hour that hasn't ended: at 3:00 PM it moves to next week's.
      let next = 1;
      while (next < sprint.weeks && hourEnd(dated, next) <= now) next++;
      intro = `Your team is in week ${week}. The next protected hour is ${hourLong(hourStart(dated, next), tz)}.`;
    }

    // One row per module (writer contract 5).
    const pathway = await ctx.db
      .query("pathwayProgress")
      .withIndex("by_person_and_module", (q) =>
        q.eq("personId", viewer.person._id),
      )
      .take(PATHWAY_MODULES.length);
    const invites = (await sprintInvites(ctx, org._id, sprint._id)).filter(
      (i) => i.status !== "revoked",
    );
    const snapshot = insights ? await latestSnapshot(ctx, sprint._id) : null;

    const saved = await latestSaved(ctx, team._id);
    let agreement: Overview["agreement"] = {
      title: "Not saved yet",
      tag: { label: "Draft", kind: "gray" },
      body: null,
    };
    if (saved) {
      const signatures = await ctx.db
        .query("agreementSignatures")
        .withIndex("by_agreement_version_and_person", (q) =>
          q.eq("agreementId", saved._id).eq("version", saved.version),
        )
        .take(MAX_MEMBERS_PER_ORG);
      const signedBy = new Set(signatures.map((s) => s.personId));
      // Over the whole seated team, opted out or not: an opt-out must never
      // flip this title. Held back below the threshold (Ruling 15), so it
      // can't single out who hasn't signed. Not a `Countable`: no number
      // leaves here, only "everyone".
      const people = await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(MAX_MEMBERS_PER_ORG);
      let seated = 0;
      let everyone = true;
      for (const person of people) {
        if (person._id === viewer.person._id) continue;
        const role = await ctx.db.get(person.roleId);
        if (!role || role.orgId !== org._id) continue;
        if (permissionsOf(role).includes("team:insights")) continue;
        seated++;
        if (!signedBy.has(person._id)) everyone = false;
      }
      everyone &&= seated >= thresholdOf(org);
      agreement = {
        title: everyone ? "Signed by the team" : "Saved",
        tag: everyone
          ? { label: "Completed", kind: "green" }
          : { label: "Saved", kind: "green" },
        body: `Last updated ${dayMonth(saved.savedAt ?? saved._creationTime, tz, true)}. You'll review it together at the week ${sprint.weeks} show and tell.`,
      };
    }

    return {
      phase,
      canManage: viewer.permissions.includes("sprint:manage"),
      intro,
      timeline,
      learning: {
        title: "Leading AI at Work",
        label: "Sprint coaching modules",
        percent: coachingPercent(pathway),
      },
      sprint: {
        title:
          phase === "complete"
            ? "Sprint complete"
            : phase === "active"
              ? `Week ${week} of ${sprint.weeks}`
              : `Starts ${dayMon(first, tz).join(" ")}`,
        tag: TAGS[phase],
        invited: invites.length,
        joined: invites.filter((i) => i.status === "accepted").length,
        projects: insights
          ? statOf(snapshot?.tasksUnderway, pending, org)
          : null,
      },
      agreement,
      team:
        insights && phase !== "draft"
          ? {
              sessionDone: {
                label: `Week ${snapshot?.week ?? 1} session done`,
                stat: statOf(snapshot?.sessionDone, pending, org),
              },
              tasksUnderway: {
                label: "Real tasks underway",
                stat: statOf(snapshot?.tasksUnderway, pending, org),
              },
            }
          : null,
    };
  },
});
