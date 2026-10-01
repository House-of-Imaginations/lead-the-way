import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { count, loadCountable } from "./privacy";
import { currentSprint } from "./sprint";
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
 * the next, and the extra run backs up the last week.
 */
export async function takeDueSnapshots(
  ctx: MutationCtx,
  org: Doc<"orgs">,
  now: number,
): Promise<number> {
  const sprint = await currentSprint(ctx, org._id);
  if (!sprint || sprint.launchedAt === undefined) return 0;
  const due: number[] = [];
  for (
    let week = 1;
    week <= sprint.weeks && hourEnd(sprint, week) <= now;
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
    const progress = await ctx.db
      .query("learningProgress")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", person._id).eq("sprintId", sprint._id),
      )
      .unique();
    sessions.set(person._id, progress?.sessionsDone ?? 0);
    const project = await ctx.db
      .query("projects")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", person._id).eq("sprintId", sprint._id),
      )
      .first();
    if (project) underway.add(person._id);
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
    });
  }
  return due.length;
}

/** The newest week's totals, which 08 shows. */
export async function latestSnapshot(
  ctx: QueryCtx,
  sprintId: Id<"sprints">,
): Promise<Doc<"teamSnapshots"> | null> {
  return await ctx.db
    .query("teamSnapshots")
    .withIndex("by_sprint_and_week", (q) => q.eq("sprintId", sprintId))
    .order("desc")
    .first();
}
