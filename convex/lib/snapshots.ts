import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { PROJECT_CATEGORIES } from "../tables/sprint";
import { completedCourse, progressOf } from "./learning";
import {
  aggregate,
  count,
  countSeated,
  loadCountable,
  loadSeated,
  thresholdOf,
} from "./privacy";
import { isPresented, projectOf } from "./projects";
import { closesAt, hourEnd } from "./sprintTime";

/**
 * TEAM TOTALS, FROZEN ONCE A WEEK (Rulings 1 and 2). A live count moves the
 * moment one person acts or opts out, so two looks a minute apart could be
 * differenced back to that person. A row taken when a week's hour ends moves
 * once a week, mixed with everyone's changes, and is never rewritten: an
 * opt-out after it shows only in the next one.
 *
 * One writer, two triggers: `moveClock` for the demo, and
 * `internal.snapshots.take`, which `sprints.launch` schedules at each hour's
 * end for a real workspace, plus once when the sprint closes, a day after
 * the last. Either takes every due week that has no row, so a late or missed
 * run is made good by the next, and the extra run backs up the last week.
 * The outcomes row has its own writer, `takeOutcomes`. A late or backstop
 * run reads the rows as they are when it runs, not as they were at the
 * hour's end: only the demo, which plays its history in order, can take a
 * week as of its hour (`cutoff`).
 *
 * Only `sprint`'s weeks, and only if it is still this org's: a run scheduled
 * for one sprint never snapshots the next.
 */
export async function takeDueSnapshots(
  ctx: MutationCtx,
  org: Doc<"orgs">,
  sprint: Doc<"sprints"> | null,
  now: number,
  cutoff = now,
): Promise<number> {
  if (!sprint || sprint.orgId !== org._id || sprint.launchedAt === undefined) {
    return 0;
  }
  const due: number[] = [];
  for (
    let week = 1;
    week <= sprint.weeks && hourEnd(sprint, week) <= cutoff;
    week++
  ) {
    const taken = await ctx.db
      .query("teamSnapshots")
      .withIndex("by_sprint_and_week", (q) =>
        q.eq("sprintId", sprint._id).eq("week", week),
      )
      .unique();
    if (!taken) due.push(week);
  }
  if (due.length === 0) return 0;

  // Counted as the privacy layer counts, asked by nobody. Each person's own
  // rows are read once (one per person and sprint, writer contract 5).
  const people = await loadCountable(ctx, org, null);
  const seated = await loadSeated(ctx, org);
  const sessions = new Map<Id<"people">, number>();
  const underway = new Set<Id<"people">>();
  for (const person of people) {
    const progress = await progressOf(ctx, person._id, sprint._id);
    sessions.set(person._id, progress?.sessionsDone ?? 0);
    if (await projectOf(ctx, person._id, sprint._id)) underway.add(person._id);
  }
  for (const week of due) {
    await ctx.db.insert("teamSnapshots", {
      orgId: org._id,
      sprintId: sprint._id,
      week,
      takenAt: now,
      sessionDone: count(
        people,
        (p) => (sessions.get(p._id) ?? 0) >= week,
        org,
      ),
      tasksUnderway: count(people, (p) => underway.has(p._id), org),
      counted: people.map((p) => p._id),
      seated: seated.map((p) => p._id),
      threshold: thresholdOf(org),
    });
  }
  return due.length;
}

/** The two check-in questions 16 compares (Ruling 10), in its order. */
const OUTCOME_QUESTIONS = ["aiConfidence", "comfortWithManager"] as const;
type OutcomeQuestion = (typeof OUTCOME_QUESTIONS)[number];

/** A sprint's one outcomes row (Ruling 10), or null until it has closed. */
export async function outcomesOf(
  ctx: QueryCtx,
  sprintId: Id<"sprints">,
): Promise<Doc<"sprintOutcomes"> | null> {
  return await ctx.db
    .query("sprintOutcomes")
    .withIndex("by_sprint", (q) => q.eq("sprintId", sprintId))
    .unique();
}

/**
 * THE SPRINT'S OUTCOMES, TAKEN ONCE WHEN IT CLOSES (Rulings 9 and 10, R-a).
 * 16 reads only this row, never a live count. It is written at `closesAt`,
 * the same instant the after check-in stops taking answers, so no answer
 * can arrive after the total it belongs to (Review Focus 4). Never
 * rewritten: a later run finds it and does nothing.
 *
 * Two triggers, as for the weeks: `moveClock` calls it in its own
 * transaction, since the demo plays its history in order and needs the row
 * at once. On real time `snapshots.take` schedules `snapshots.takeOutcomes`
 * once the sprint has closed, so a throw here can't take the week rows with
 * it. Only `sprint`'s row, and only if it is still this org's.
 *
 * - Completed and the averages count `loadCountable`: no manager, nobody
 *   opted out, nobody asking. An average counts answers only; a skip (no
 *   score) or no row is nobody answering (Review Focus 3).
 * - Presented counts every seated presenter, opted out or not, because
 *   presenting is public (R-i). The categories add up to it, so they are
 *   left out when it is hidden.
 * - `counted`, `seated` and `threshold` let `snapshotSeries` and `statOf`
 *   judge the row later (Rulings FX and 7).
 */
export async function takeOutcomes(
  ctx: MutationCtx,
  org: Doc<"orgs">,
  sprint: Doc<"sprints"> | null,
  now: number,
  cutoff = now,
): Promise<void> {
  if (!sprint || sprint.orgId !== org._id || sprint.launchedAt === undefined) {
    return;
  }
  if (closesAt(sprint) > cutoff) return;
  if (await outcomesOf(ctx, sprint._id)) return;

  // Each person's own rows, read once: one progress row per person and
  // sprint, and at most six check-in rows (writer contract 5).
  const countable = await loadCountable(ctx, org, null);
  const finished = new Set<Id<"people">>();
  const responses = new Map<Id<"people">, Doc<"surveyResponses">[]>();
  for (const person of countable) {
    if (completedCourse(await progressOf(ctx, person._id, sprint._id))) {
      finished.add(person._id);
    }
    responses.set(
      person._id,
      await ctx.db
        .query("surveyResponses")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", person._id).eq("sprintId", sprint._id),
        )
        .take(6),
    );
  }
  /** That person's score, or undefined for no row or a skip. */
  const scoreOf = (
    person: Doc<"people">,
    phase: "before" | "after",
    question: OutcomeQuestion,
  ) =>
    responses
      .get(person._id)
      ?.find((r) => r.phase === phase && r.question === question)?.score;

  const seated = await loadSeated(ctx, org);
  const presenters = new Map<Id<"people">, Doc<"projects">>();
  for (const person of seated) {
    const project = await projectOf(ctx, person._id, sprint._id);
    if (project && isPresented(project)) presenters.set(person._id, project);
  }
  const presented = countSeated(seated, (p) => presenters.has(p._id), org);
  const projects = [...presenters.values()];
  const categories = presented.hidden
    ? []
    : PROJECT_CATEGORIES.map((label) => ({
        label,
        count: projects.filter((p) => p.category === label).length,
      })).filter((c) => c.count > 0);

  await ctx.db.insert("sprintOutcomes", {
    orgId: org._id,
    sprintId: sprint._id,
    takenAt: now,
    counted: countable.map((p) => p._id),
    seated: seated.map((p) => p._id),
    threshold: thresholdOf(org),
    completed: count(countable, (p) => finished.has(p._id), org),
    presented,
    categories,
    answers: OUTCOME_QUESTIONS.map((question) => ({
      question,
      before: aggregate(countable, (p) => scoreOf(p, "before", question), org),
      after: aggregate(countable, (p) => scoreOf(p, "after", question), org),
    })),
  });
}

export type SeriesRow<T> = { row: T; comparable: boolean };

/**
 * WHAT A READER MAY SET SIDE BY SIDE (Ruling FX, R-e): the weekly rows in week
 * order, then the outcomes row last. One fixed group per sprint: a row is
 * comparable only when it stored both `counted` and `seated` and both equal
 * the first row's, as sets. The first row is the reference; without both
 * lists, nothing is comparable.
 *
 * Why one group, not "close enough": two totals over cohorts one person
 * apart difference back to that person, and so can any combination of
 * totals over different cohorts (weeks counting Mei + A, Mei + B and A + B
 * are pairwise far apart, yet together give Mei away). When every shown row
 * has the one cohort, no combination of shown totals can be differenced.
 * The roster is public, so checking it too means a role change hides the
 * rows whatever that person's opt-out, and the show or hide decision never
 * says whether they had opted out. The threshold plays no part, so raising
 * it can't change which rows compare.
 *
 * The decision is the same for every reader. Only then is a row that
 * counted this reader hidden from them too (they know their own part); that
 * touches no other row. After any change, totals stay hidden until a row
 * counts and seats the first row's group again; the copy says why, naming
 * nobody.
 *
 * The one place this is decided, so 08 and 16 can't disagree. `counted` and
 * `seated` never leave this file's callers.
 */
export async function snapshotSeries(
  ctx: QueryCtx,
  sprint: Doc<"sprints">,
  readerId: Id<"people">,
): Promise<{
  weeks: SeriesRow<Doc<"teamSnapshots">>[];
  outcomes: SeriesRow<Doc<"sprintOutcomes">> | null;
}> {
  // One row per week (writer contract), so a sprint's weeks bound the read.
  const weekly = await ctx.db
    .query("teamSnapshots")
    .withIndex("by_sprint_and_week", (q) => q.eq("sprintId", sprint._id))
    .take(sprint.weeks);
  const final = await outcomesOf(ctx, sprint._id);

  const ref = weekly[0] ?? final;
  const sameSet = (a: Id<"people">[], b: Id<"people">[]) => {
    const set = new Set(a);
    return set.size === new Set(b).size && b.every((id) => set.has(id));
  };
  const mark = <
    R extends { counted?: Id<"people">[]; seated?: Id<"people">[] },
  >(
    row: R,
  ): SeriesRow<R> => ({
    row,
    comparable:
      !!ref?.counted &&
      !!ref.seated &&
      !!row.counted &&
      !!row.seated &&
      sameSet(row.counted, ref.counted) &&
      sameSet(row.seated, ref.seated) &&
      !row.counted.includes(readerId),
  });
  return { weeks: weekly.map(mark), outcomes: final ? mark(final) : null };
}
