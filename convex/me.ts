import { literals } from "convex-helpers/validators";
import { v, type Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { agreementForViewer, dayMonth } from "./lib/agreement";
import { timedViewerQuery } from "./lib/customFunctions";
import { progressOf, sessionOf } from "./lib/learning";
import { isPresented, projectOf } from "./lib/projects";
import { greetingOf } from "./lib/shell";
import { launchedSprint } from "./lib/sprint";
import { afterCheckInOpen, answeredAfter, answeredBefore } from "./lib/surveys";
import {
  hourEnd,
  hourLong,
  hourRange,
  hourStart,
  nextHour,
  parts,
  spanLabel,
  sprintPhase,
  weekOf,
  zoneNote,
} from "./lib/sprintTime";
import type { Viewer } from "./lib/viewer";
import { SURVEY_QUESTIONS } from "./tables/sprint";

/**
 * Dan's week (11, M2) and his sprint (13). Each reads only the viewer's own
 * rows (spec 5.1 rule 6), and makes every label here.
 */

const tagValidator = v.object({
  label: v.string(),
  kind: literals("blue", "green", "gray"),
});

export const homeValidator = v.object({
  greeting: v.string(), // "Good afternoon, Dan"
  intro: v.string(), // "Week 2 of 4. Your protected hour starts today at 2:00 PM."
  protectedTag: v.string(), // "Protected time, Wed 2:00 to 3:00 PM"
  /** `session` counts from 1; the page reads its line from `src/content/sessions.ts`. */
  learn: v.object({
    course: v.string(),
    session: v.number(),
    percent: v.number(),
  }),
  reflect: tagValidator, // "Not started" or "Added"
  /** The 4-week strip. `short` and `shortStatus` are M2's ("Wk 2", "Now"). */
  weeks: v.array(
    v.object({
      name: v.string(), // "Week 2"
      short: v.string(), // "Wk 2"
      status: v.string(), // "Done", "In progress", "23 Sep", "Show and tell"
      shortStatus: v.string(), // "Done", "Now", "23 Sep", "30 Sep"
      state: literals("done", "current", "todo"),
    }),
  ),
  /** Null before the first save of the agreement. */
  agreement: v.union(
    v.null(),
    v.object({
      tools: v.string(), // "Microsoft Copilot, ChatGPT Enterprise"
      neverIn: v.string(), // "Client names, personal information, passwords"
      contact: v.string(), // "Ask Priya Raman"
    }),
  ),
  /** Signed an older version than the latest saved (10's `mine: "updated"`). */
  agreementUpdated: v.boolean(),
  /** Ruling 7: from week 4 until the after check-in is answered. */
  afterCheckIn: v.boolean(),
  /** From the second sprint, in week 1 or before, until answered or skipped (P7a Ruling 17). */
  beforeCheckIn: v.boolean(),
});
export type Home = Infer<typeof homeValidator>;

const activityValidator = v.object({
  label: v.string(), // "Learn", "Apply", "Apply, in progress", "Show and tell"
  state: literals("done", "progress", "todo"),
  href: v.union(v.null(), v.string()),
});

export const mySprintValidator = v.object({
  intro: v.string(), // "9 to 30 September 2026. Three of eight activities done."
  done: v.number(),
  of: v.number(),
  count: v.string(), // "3 of 8"
  weeks: v.array(
    v.object({
      name: v.string(), // "Week 2"
      date: v.string(), // "16 September"
      tag: v.union(v.null(), tagValidator), // "Done" or "Now"
      current: v.boolean(),
      activities: v.array(activityValidator),
    }),
  ),
  /** Null once the last hour has ended. */
  next: v.union(
    v.null(),
    v.object({
      day: v.string(), // "Wednesday, 2:00 PM"
      detail: v.string(), // "16 September, 1 hour, protected from meetings"
    }),
  ),
  /** `CalendarHour` for "Add to calendar". */
  calendar: v.object({
    title: v.string(),
    startDate: v.string(),
    timeZone: v.string(),
    weeks: v.number(),
    protectedHour: v.object({
      weekday: v.number(),
      start: v.string(),
      durationMinutes: v.number(),
    }),
  }),
});
export type MySprint = Infer<typeof mySprintValidator>;
type Activity = Infer<typeof activityValidator>;

type Launched = {
  sprint: Doc<"sprints">;
  now: number;
  /** `weekOf`: 0 before week one's Monday, not clamped after the last. */
  week: number;
  complete: boolean;
  /** ", Melbourne time" when the viewer lives elsewhere (Ruling 17). */
  note: string;
};

/** The workspace's launched sprint and where it is. Null before launch. */
async function launchedFor(
  ctx: QueryCtx,
  viewer: Viewer,
): Promise<Launched | null> {
  const sprint = await launchedSprint(ctx, viewer.org._id);
  if (!sprint) return null;
  // `now` is a getter that reads the clock; read it once.
  const now = viewer.now;
  return {
    sprint,
    now,
    week: weekOf(sprint, now),
    complete: sprintPhase(sprint, now) === "complete",
    note: zoneNote(sprint.timeZone, viewer.person.timeZone),
  };
}

/** "2:00 PM" */
function clockOf(at: number, tz: string): string {
  const p = parts(at, tz, { hour: "numeric", minute: "2-digit" });
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "23 Sep" */
function dayShort(at: number, tz: string): string {
  const p = parts(at, tz, { day: "numeric", month: "short" });
  return `${p.day} ${p.month}`;
}

/** "Wednesday" */
const weekdayOf = (at: number, tz: string) =>
  parts(at, tz, { weekday: "long" }).weekday!;

/** 11's line under the greeting: where the sprint is, and where this week's hour is. */
function introOf({ sprint, now, week, complete, note }: Launched): string {
  const tz = sprint.timeZone;
  if (complete) {
    const last = hourStart(sprint, sprint.weeks);
    return `Your sprint finished on ${weekdayOf(last, tz)} ${dayMonth(last, tz)}.`;
  }
  if (week === 0) {
    return `Your sprint starts ${hourLong(hourStart(sprint, 1), tz)}${note}.`;
  }
  // Not complete, so the last hour hasn't ended and there is a next one.
  const next = nextHour(sprint, now)!;
  const lead = `Week ${week} of ${sprint.weeks}.`;
  if (next.week > week) {
    return `${lead} Your next protected hour is ${hourLong(next.start, tz)}${note}.`;
  }
  if (next.start <= now) {
    return `${lead} Your protected hour is on now, until ${clockOf(hourEnd(sprint, week), tz)}${note}.`;
  }
  if (dayMonth(next.start, tz, true) === dayMonth(now, tz, true)) {
    return `${lead} Your protected hour starts today at ${clockOf(next.start, tz)}${note}.`;
  }
  return `${lead} Your protected hour is ${weekdayOf(next.start, tz)} at ${clockOf(next.start, tz)}${note}.`;
}

/** 11's strip: past weeks done, this week in progress, later ones by date. */
function stripOf({ sprint, week, complete }: Launched): Home["weeks"] {
  const out: Home["weeks"] = [];
  for (let w = 1; w <= sprint.weeks; w++) {
    const names = { name: `Week ${w}`, short: `Wk ${w}` };
    const date = dayShort(hourStart(sprint, w), sprint.timeZone);
    if (complete || w < week) {
      out.push({ ...names, status: "Done", shortStatus: "Done", state: "done" });
    } else if (w === week) {
      out.push({
        ...names,
        status: "In progress",
        shortStatus: "Now",
        state: "current",
      });
    } else {
      out.push({
        ...names,
        status: w === sprint.weeks ? "Show and tell" : date,
        shortStatus: date,
        state: "todo",
      });
    }
  }
  return out;
}

/**
 * Ruling 22's Apply: a past week is done when a project was started by then;
 * this week is in progress with a draft and done once saved.
 */
function applyOf(
  w: number,
  past: boolean,
  current: boolean,
  project: Doc<"projects"> | null,
): Activity {
  let state: Activity["state"] = "todo";
  if (past && project && project.startedWeek <= w) state = "done";
  if (current && project) state = project.status === "saved" ? "done" : "progress";
  return {
    label: state === "progress" ? "Apply, in progress" : "Apply",
    state,
    href: current ? "/me/project" : null,
  };
}

const WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];
const word = (n: number) => WORDS[n] ?? String(n);

// ponytail: two phases of SURVEY_QUESTIONS is every row one person can have in a sprint.
const MY_SURVEY_ROWS = 2 * SURVEY_QUESTIONS.length;

/**
 * 11 and M2. `hour` is ignored (Ruling 16): a new hour is a new query, so
 * "today", "on now" and the strip turn over without a reload.
 */
export const home = timedViewerQuery()({
  args: {},
  returns: v.union(v.null(), homeValidator),
  handler: async (ctx): Promise<Home | null> => {
    const { viewer } = ctx;
    const launched = await launchedFor(ctx, viewer);
    if (!launched) return null;
    const { sprint, now, week, note } = launched;
    const me = viewer.person._id;
    const [progress, project, answers, first] = await Promise.all([
      progressOf(ctx, me, sprint._id),
      projectOf(ctx, me, sprint._id),
      ctx.db
        .query("surveyResponses")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", me).eq("sprintId", sprint._id),
        )
        .take(MY_SURVEY_ROWS),
      // The oldest sprint is the first launched: a clone only follows a launched one.
      ctx.db
        .query("sprints")
        .withIndex("by_org", (q) => q.eq("orgId", viewer.org._id))
        .first(),
    ]);
    // Task 6's read, so 10 and 11 can't disagree on "updated".
    const forMe = await agreementForViewer(ctx, viewer);
    return {
      greeting: greetingOf(viewer, now),
      intro: introOf(launched),
      protectedTag: `Protected time, ${hourRange(sprint.protectedHour, "short")}${note}`,
      learn: {
        course: sprint.courseTitle,
        session: sessionOf(week),
        percent: progress?.percent ?? 0,
      },
      reflect: project?.learned?.trim()
        ? { label: "Added", kind: "green" }
        : { label: "Not started", kind: "gray" },
      weeks: stripOf(launched),
      agreement: forMe
        ? {
            // 10 reads the list as a sentence; 11's card shows the list.
            tools: forMe.toolList.length
              ? forMe.toolList.join(", ")
              : "None agreed yet.",
            neverIn: forMe.neverIn.length
              ? [
                  ...forMe.neverIn.slice(0, 3),
                  ...(forMe.neverIn.length > 3
                    ? [`and ${forMe.neverIn.length - 3} more`]
                    : []),
                ].join(", ")
              : "None agreed yet.",
            contact: `Ask ${forMe.contactName}`,
          }
        : null,
      agreementUpdated: forMe?.mine === "updated",
      afterCheckIn: afterCheckInOpen(sprint, now) && !answeredAfter(answers),
      // Sprint 1 asks at join (P6 Ruling 7). Later sprints have no join, so
      // /me asks until the end of week 1 (P7a Ruling 17).
      beforeCheckIn:
        first?._id !== sprint._id && week <= 1 && !answeredBefore(answers),
    };
  },
});

/**
 * 13. Ruling 22 counts 8 activities from rows Dan owns: per week a Learn and
 * an Apply, with Show and tell in place of the last week's Apply.
 */
export const sprint = timedViewerQuery()({
  args: {},
  returns: v.union(v.null(), mySprintValidator),
  handler: async (ctx): Promise<MySprint | null> => {
    const { viewer } = ctx;
    const launched = await launchedFor(ctx, viewer);
    if (!launched) return null;
    const { sprint, now, week, complete, note } = launched;
    const tz = sprint.timeZone;
    const me = viewer.person._id;
    const [progress, project] = await Promise.all([
      progressOf(ctx, me, sprint._id),
      projectOf(ctx, me, sprint._id),
    ]);
    const sessions = progress?.sessionsDone ?? 0;

    const weeks: MySprint["weeks"] = [];
    for (let w = 1; w <= sprint.weeks; w++) {
      const past = complete || w < week;
      const current = !past && w === week;
      const activities: Activity[] = [
        { label: "Learn", state: sessions >= w ? "done" : "todo", href: null },
        w < sprint.weeks
          ? applyOf(w, past, current, project)
          : {
              label: "Show and tell",
              state: project && isPresented(project) ? "done" : "todo",
              href: "/me/show-and-tell",
            },
      ];
      weeks.push({
        name: `Week ${w}`,
        date: dayMonth(hourStart(sprint, w), tz),
        tag: past
          ? { label: "Done", kind: "green" }
          : current
            ? { label: "Now", kind: "blue" }
            : null,
        current,
        activities,
      });
    }
    const done = weeks
      .flatMap((w) => w.activities)
      .filter((a) => a.state === "done").length;
    const of = sprint.weeks * 2;
    const next = nextHour(sprint, now);
    const minutes = sprint.protectedHour.durationMinutes;

    return {
      intro: `${spanLabel(hourStart(sprint, 1), hourStart(sprint, sprint.weeks), tz)}. ${word(done)} of ${word(of).toLowerCase()} activities done.`,
      done,
      of,
      count: `${done} of ${of}`,
      weeks,
      next: next
        ? {
            day: `${weekdayOf(next.start, tz)}, ${clockOf(next.start, tz)}${note}`,
            detail: `${dayMonth(next.start, tz)}, ${minutes === 60 ? "1 hour" : `${minutes} minutes`}, protected from meetings`,
          }
        : null,
      calendar: {
        title: "Protected learning hour",
        startDate: sprint.startDate,
        timeZone: tz,
        weeks: sprint.weeks,
        protectedHour: sprint.protectedHour,
      },
    };
  },
});
