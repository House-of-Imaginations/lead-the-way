import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { progressOf } from "./learning";
import { count, loadCountable, thresholdOf } from "./privacy";
import { projectOf } from "./projects";
import { hourEnd } from "./sprintTime";

/**
 * TEAM TOTALS, FROZEN ONCE A WEEK (Rulings 1 and 2). A live count moves the
 * moment one person acts or opts out, so two looks a minute apart could be
 * differenced back to that person. A row taken when a week's hour ends moves
 * once a week, mixed with everyone's changes, and is never rewritten: an
 * opt-out after it shows only in the next one.
 *
 * One writer, two triggers: `moveClock` for the demo, and
 * `internal.snapshots.take`, which `sprints.launch` schedules at each hour's
 * end for a real workspace, plus once a day after the last. Either takes
 * every due week that has no row, so a late or missed run is made good by
 * the next, and the extra run backs up the last week. A late or backstop run
 * reads the rows as they are when it runs, not as they were at the hour's
 * end: only the demo, which plays its history in order, can take a week as
 * of its hour (`cutoff`).
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
      threshold: thresholdOf(org),
    });
  }
  return due.length;
}

export type SeriesRow<T> = { row: T; comparable: boolean };

/**
 * WHAT A READER MAY SET SIDE BY SIDE (Ruling 6, R-e). Two totals over cohorts
 * one person apart difference back to that person: week 1 counts Mei, week 2
 * doesn't (she opted out, or now reads totals), so week 1 less week 2 is Mei.
 * Walking the weeks in order, a row is comparable only when it stored its
 * cohort, the reader isn't in it (they know their own part), and it differs
 * from the last row shown by nobody or by at least the threshold. It is
 * compared with the last row SHOWN, not the row before, so week 3 can't be
 * read against week 1 once week 2 is hidden. After a small change, totals
 * stay hidden for the rest of the sprint; the copy says why, naming nobody.
 *
 * The one place this is decided, so 08 and 16 can't disagree. `outcomes` is
 * null for now: the sprint's outcomes row, walked after the weeks, comes with
 * `sprintOutcomes`.
 */
export async function snapshotSeries(
  ctx: QueryCtx,
  sprint: Doc<"sprints">,
  org: Doc<"orgs">,
  readerId: Id<"people">,
): Promise<{ weeks: SeriesRow<Doc<"teamSnapshots">>[]; outcomes: null }> {
  // One row per week (writer contract), so a sprint's weeks bound the read.
  const rows = await ctx.db
    .query("teamSnapshots")
    .withIndex("by_sprint_and_week", (q) => q.eq("sprintId", sprint._id))
    .take(sprint.weeks);
  let last: Set<Id<"people">> | null = null;
  const comparable = (counted: Id<"people">[] | undefined) => {
    if (!counted || counted.includes(readerId)) return false;
    const cohort = new Set(counted);
    if (last) {
      let changed = 0;
      for (const id of cohort) if (!last.has(id)) changed++;
      for (const id of last) if (!cohort.has(id)) changed++;
      if (changed > 0 && changed < thresholdOf(org)) return false;
    }
    last = cohort;
    return true;
  };
  return {
    weeks: rows.map((row) => ({ row, comparable: comparable(row.counted) })),
    outcomes: null,
  };
}
