import { v, type Infer } from "convex/values";
import { badgeOf } from "./lib/badges";
import { timedViewerQuery } from "./lib/customFunctions";
import { firstNameOf } from "./lib/orgs/people";
import { isPresented, projectOf } from "./lib/projects";
import { settingsOf } from "./lib/settings";
import { currentSprint } from "./lib/sprint";
import { weekOf } from "./lib/sprintTime";
import { afterCheckInOpen, answeredAfter } from "./lib/surveys";

const boardValidator = v.object({
  weekTag: v.union(v.string(), v.null()), // "Week 4" in the show and tell week
  askBeforeSharing: v.boolean(),
  afterCheckIn: v.boolean(), // show the after check-in card (Ruling 7)
  hasBadge: v.boolean(),
  mine: v.union(
    v.null(),
    v.object({
      title: v.string(),
      headline: v.string(),
      before: v.string(),
      change: v.string(),
      after: v.string(),
      learned: v.union(v.string(), v.null()),
      humanReviewed: v.boolean(),
      dataSafe: v.boolean(),
      presented: v.boolean(),
      onBadge: v.boolean(),
    }),
  ),
  presented: v.array(v.object({ title: v.string(), firstName: v.string() })),
});
export type Board = Infer<typeof boardValidator>;

// ponytail: the first 200 presented projects of one sprint, oldest first; a
// later presenter past that is left off the board. Paginate if a team gets there.
const PROJECTS_READ = 200;

/**
 * 14. Other people's projects reach this board only once presented
 * (`isPresented`), and only as a title and a first name, in the order they
 * were presented (spec rule 10). The viewer's own saved project comes back
 * whole as `mine`, presented or not.
 */
export const board = timedViewerQuery()({
  args: {},
  returns: v.union(v.null(), boardValidator),
  handler: async (ctx): Promise<Board | null> => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;
    const personId = viewer.person._id;
    const sprint = await currentSprint(ctx, orgId);
    if (!sprint) return null;
    const week = weekOf(sprint, viewer.now);
    const [settings, badge, answers, own, rows] = await Promise.all([
      settingsOf(ctx, personId),
      badgeOf(ctx, personId),
      // Bounded: one row per phase and question for one person (writer contract).
      ctx.db
        .query("surveyResponses")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", personId).eq("sprintId", sprint._id),
        )
        .collect(),
      projectOf(ctx, personId, sprint._id),
      // Only rows with a presentedAt, in presentation order (spec rule 10): a
      // missing field sorts before every number, so drafts and unpresented
      // rows are outside the range, and a teammate's autosave never re-runs
      // this board.
      ctx.db
        .query("projects")
        .withIndex("by_sprint_and_presentedAt", (q) =>
          q.eq("sprintId", sprint._id).gte("presentedAt", 0),
        )
        .take(PROJECTS_READ),
    ]);

    const presented: Board["presented"] = [];
    for (const p of rows.filter(isPresented)) {
      const person = await ctx.db.get(p.personId);
      if (person) {
        presented.push({ title: p.title, firstName: firstNameOf(person.name) });
      }
    }

    return {
      weekTag: week === sprint.weeks ? `Week ${week}` : null,
      askBeforeSharing: settings.askBeforeSharing,
      afterCheckIn:
        afterCheckInOpen(sprint, viewer.now) && !answeredAfter(answers),
      hasBadge: badge !== null,
      mine:
        own?.status === "saved"
          ? {
              title: own.title,
              headline: own.headline ?? "",
              before: own.before,
              change: own.change,
              after: own.after,
              learned: own.learned ?? null,
              humanReviewed: own.humanReviewed,
              dataSafe: own.dataSafe,
              presented: isPresented(own),
              onBadge: badge?.reflectionProjectId === own._id,
            }
          : null,
      presented,
    };
  },
});
