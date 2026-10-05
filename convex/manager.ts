import { literals } from "convex-helpers/validators";
import { v, type Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { dayMonth, latestSaved } from "./lib/agreement";
import { timedViewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { MAX_MEMBERS_PER_ORG } from "./lib/orgs/membership";
import { PATHWAY_MODULES, coachingPercent } from "./lib/pathway";
import {
  MIN_THRESHOLD,
  loadSeated,
  thresholdOf,
  type Aggregate,
} from "./lib/privacy";
import { ROUTE_PERMISSION, isManager } from "./lib/orgs/permissions";
import { snapshotSeries } from "./lib/snapshots";
import {
  currentSprint,
  currentTeam,
  setupGate,
  sprintInvites,
} from "./lib/sprint";
import {
  closesAt,
  hourEnd,
  hourLabel,
  hourLong,
  hourStart,
  nextHour,
  parts,
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
  const p = parts(at, timeZone, { day: "numeric", month: "short" });
  return [p.day!, p.month!];
}

/** "1 to 8 Sep", or "31 Aug to 8 Sep" across months. */
function spanShort(from: number, to: number, timeZone: string): string {
  const [d1, m1] = dayMon(from, timeZone);
  const [d2, m2] = dayMon(to, timeZone);
  return m1 === m2 ? `${d1} to ${d2} ${m2}` : `${d1} ${m1} to ${d2} ${m2}`;
}

/** Ruling 6's helper: why a total is hidden, naming nobody. */
const COHORT_CHANGED = "Hidden after a change to who is counted";

/**
 * A stored total on a tile (Ruling 7), checked against the threshold now and
 * the one it was taken under (a row with none was taken at 5). A total hidden
 * under an older, higher threshold has no value stored, so lowering the
 * threshold can't show it: a weekly row says the next row will; the final
 * row (`final`: the outcomes row, or week 4's) has no next row, so it says
 * what it was taken under. Whether the row exists and may be compared at all
 * (Ruling 6) is the caller's to decide.
 */
function statOf(
  total: Aggregate,
  rowThreshold: number | undefined,
  org: Doc<"orgs">,
  final = false,
): Stat {
  const now = thresholdOf(org);
  const taken = rowThreshold ?? MIN_THRESHOLD;
  if (total.hidden && total.n >= now && taken > now) {
    return {
      kind: "hidden",
      helper: final
        ? `Hidden until ${taken} responses`
        : "Shown from next week's totals",
    };
  }
  if (total.hidden || total.n < now) {
    return { kind: "hidden", helper: `Hidden until ${now} responses` };
  }
  return { kind: "shown", value: total.value, of: total.n };
}

/**
 * 08, the manager overview. Every label is made here; the page formats only
 * `value` and `of`.
 *
 * Any manager may read it, so /manager never refuses its own home (Ruling 6).
 * Team totals and the projects count need `team:insights`, and come only from
 * the newest weekly snapshot, read through `snapshotSeries` (P7a Ruling 6),
 * never a live count (Ruling 1). Invited and joined are live membership facts
 * (Ruling 3). `hour` is never read: the server passes the current hour so the
 * cached answer turns over each hour (Ruling 14).
 */
export const overview = timedViewerQuery()({
  args: {},
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
      const { weekday } = parts(last, tz, { weekday: "long" });
      intro = `Your sprint finished on ${weekday} ${dayMonth(last, tz)}.`;
    } else if (phase === "active") {
      // Active means the last hour hasn't ended, so there is a next one.
      const next = nextHour(dated, now)!;
      intro = `Your team is in week ${week}. The next protected hour is ${hourLong(next.start, tz)}.`;
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
    // The newest week, as the series lets this viewer read it.
    const series = insights
      ? await snapshotSeries(ctx, sprint, org, viewer.person._id)
      : null;
    const latest = series?.weeks.at(-1);
    const tile = (key: "sessionDone" | "tasksUnderway"): Stat =>
      !latest
        ? { kind: "pending", helper: pending }
        : !latest.comparable
          ? { kind: "hidden", helper: COHORT_CHANGED }
          : statOf(
              latest.row[key],
              latest.row.threshold,
              org,
              // The last week has no next weekly row to show it (Q-2).
              latest.row.week === sprint.weeks,
            );

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
      // Over the whole seated team, opted out or not, the viewer too: an
      // opt-out must never flip this title, nor who is looking. Held back
      // below the threshold (Ruling 15), so it can't single out who hasn't
      // signed. No number leaves here, only "everyone".
      const seated = await loadSeated(ctx, org);
      const everyone =
        seated.length >= thresholdOf(org) &&
        seated.every((person) => signedBy.has(person._id));
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
      canManage: viewer.permissions.includes(
        ROUTE_PERMISSION["/manager/sprint/launch"],
      ),
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
        projects: insights ? tile("tasksUnderway") : null,
      },
      agreement,
      team:
        insights && phase !== "draft"
          ? {
              sessionDone: {
                label: `Week ${latest?.row.week ?? 1} session done`,
                stat: tile("sessionDone"),
              },
              tasksUnderway: {
                label: "Real tasks underway",
                stat: tile("tasksUnderway"),
              },
            }
          : null,
    };
  },
});

/** 16's answer (Rulings 11 and 12). Every label is made here. */
export const outcomesValidator = v.union(
  v.object({
    state: v.literal("pending"),
    title: v.string(), // "Sprint in progress" or "Sprint complete"
    helper: v.string(), // "Outcomes appear on Thu 1 Oct, the day after the last protected hour."
    canRunAnother: v.literal(false),
    inviteLink: v.string(), // "/signup?ref=calder-lane": the page prefixes window.location.origin
  }),
  v.object({
    state: v.literal("closed"),
    title: v.literal("Sprint complete"),
    tag: v.string(), // "Finished 30 Sep"
    intro: v.string(),
    canRunAnother: v.boolean(), // sprint:manage, and the newest sprint is this one
    inviteLink: v.string(),
    participation: v.object({
      invited: v.number(),
      completed: statValidator,
      presented: statValidator,
    }),
    beforeAfter: v.object({
      caption: v.string(), // "Team average on a 1 to 5 scale, 5 responses before and 7 after"
      beforeLabel: v.string(), // "Before, 8 Sep"
      afterLabel: v.string(), // "After, 30 Sep"
      questions: v.array(
        v.object({
          title: v.string(),
          quote: v.union(v.null(), v.string()),
          before: statValidator,
          after: statValidator,
        }),
      ),
    }),
    projects: v.object({
      caption: v.union(v.null(), v.string()), // "6 projects completed", null when hidden
      categories: v.array(v.object({ label: v.string(), count: v.number() })),
    }),
  }),
);
export type Outcomes = Infer<typeof outcomesValidator>;

/** A total on a row that isn't comparable (Ruling 6). It never says who changed. */
const CHANGED: Stat = { kind: "hidden", helper: COHORT_CHANGED };

/** 16's two questions, as the spec words them (spec 3.3, "Survey"). */
const QUESTIONS: Record<
  "aiConfidence" | "comfortWithManager",
  { title: string; quote: string | null }
> = {
  aiConfidence: { title: "Confidence using AI at work", quote: null },
  comfortWithManager: {
    title: "Comfort discussing AI with my manager",
    quote: "I feel comfortable telling my manager how I use AI at work.",
  },
};

/**
 * 16, the sprint's outcomes. Reads only the stored `sprintOutcomes` row,
 * through `snapshotSeries`, never a live count (R-a; the static test in
 * tests/convex/outcomes.test.ts keeps `count` and `aggregate` out of this
 * file). Pending until the sprint closes (Ruling 12), null before launch.
 * Invited is the live, non-revoked invitation count, as on 08 (Ruling 11).
 * Dates come from the sprint, never from a response's time.
 */
export const outcomes = timedViewerQuery("team:insights")({
  args: {},
  returns: v.union(v.null(), outcomesValidator),
  handler: async (ctx): Promise<Outcomes | null> => {
    const { viewer } = ctx;
    const org = viewer.org;
    // Task 6 reads `launchedSprint` here instead (Ruling 15).
    const sprint = await currentSprint(ctx, org._id);
    const launchedAt = sprint?.launchedAt;
    if (!sprint || launchedAt === undefined) return null;
    // `now` is a getter that reads the clock; read it once.
    const now = viewer.now;
    const tz = sprint.timeZone;
    const inviteLink = `/signup?ref=${org.slug}`;

    const { outcomes: final } = await snapshotSeries(
      ctx,
      sprint,
      org,
      viewer.person._id,
    );
    if (!final) {
      const day = parts(closesAt(sprint), tz, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      return {
        state: "pending",
        title:
          sprintPhase(sprint, now) === "complete"
            ? "Sprint complete"
            : "Sprint in progress",
        helper: `Outcomes appear on ${day.weekday} ${day.day} ${day.month}, the day after the last protected hour.`,
        canRunAnother: false,
        inviteLink,
      };
    }

    const { row, comparable } = final;
    // Ruling 7, final: no "next week" on the outcomes row.
    const stat = (total: Aggregate): Stat =>
      comparable ? statOf(total, row.threshold, org, true) : CHANGED;
    const invites = (await sprintInvites(ctx, org._id, sprint._id)).filter(
      (i) => i.status !== "revoked",
    );
    const presented = stat(row.presented);
    const questions = row.answers.map((a) => ({
      ...QUESTIONS[a.question],
      before: stat(a.before),
      after: stat(a.after),
    }));
    // Each phase's smallest shown n; a phase hidden throughout says nothing.
    // "responses" once, after the first number: "5 responses before and 7 after".
    const clauses = (["before", "after"] as const)
      .flatMap((phase) => {
        const ns = questions.flatMap((q) => {
          const s = q[phase];
          return s.kind === "shown" ? [s.of] : [];
        });
        return ns.length ? [{ n: Math.min(...ns), phase }] : [];
      })
      .map(({ n, phase }, i) => `${n} ${i === 0 ? "responses " : ""}${phase}`);

    return {
      state: "closed",
      title: "Sprint complete",
      tag: `Finished ${dayMon(hourEnd(sprint, sprint.weeks), tz).join(" ")}`,
      intro:
        "Your team made AI learning part of the working week. Here is what changed, as a team.",
      // Task 6 adds "and the newest sprint is this one".
      canRunAnother: viewer.permissions.includes("sprint:manage"),
      inviteLink,
      participation: {
        invited: invites.length,
        completed: stat(row.completed),
        presented,
      },
      beforeAfter: {
        caption: ["Team average on a 1 to 5 scale", clauses.join(" and ")]
          .filter(Boolean)
          .join(", "),
        beforeLabel: `Before, ${dayMon(launchedAt, tz).join(" ")}`,
        afterLabel: `After, ${dayMon(hourStart(sprint, sprint.weeks), tz).join(" ")}`,
        questions,
      },
      // The categories add up to presented, so they go wherever it is hidden.
      projects:
        presented.kind === "shown"
          ? {
              caption: `${presented.value} ${presented.value === 1 ? "project" : "projects"} completed`,
              categories: row.categories,
            }
          : { caption: null, categories: [] },
    };
  },
});
