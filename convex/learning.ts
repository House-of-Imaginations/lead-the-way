import { v } from "convex/values";
import { badgeOf, issueBadge } from "./lib/badges";
import { viewerMutation } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { COURSE_SESSIONS, progressOf, sessionOf } from "./lib/learning";
import { currentSprint } from "./lib/sprint";
import { weekOf } from "./lib/sprintTime";

/**
 * 11's "Continue learning" (Ruling 8). The prototype can't reach SkillsBuild,
 * so a press marks this week's session done. It never lowers a value (writer
 * contract rule 3): the script may already be ahead of the clock. The fourth
 * session issues the badge. The script's `progress` logs no event, so neither
 * does this.
 */
export const continueSession = viewerMutation()({
  args: {},
  returns: v.object({
    sessionsDone: v.number(),
    percent: v.number(),
    badgeIssued: v.boolean(),
  }),
  handler: async (ctx) => {
    const { viewer } = ctx;
    const sprint = await currentSprint(ctx, viewer.org._id);
    if (!sprint || sprint.launchedAt === undefined) {
      throwUserError("NO_SPRINT", "Your sprint hasn't started yet.");
    }
    // `now` is a getter that reads the clock; read it once.
    const now = viewer.now;
    const row = await progressOf(ctx, viewer.person._id, sprint._id);
    const sessionsDone = Math.max(
      row?.sessionsDone ?? 0,
      sessionOf(weekOf(sprint, now)),
    );
    const percent = Math.max(row?.percent ?? 0, sessionsDone * 25);
    if (!row) {
      await ctx.db.insert("learningProgress", {
        orgId: viewer.org._id,
        personId: viewer.person._id,
        sprintId: sprint._id,
        sessionsDone,
        percent,
        updatedAt: now,
      });
    } else if (sessionsDone > row.sessionsDone || percent > row.percent) {
      await ctx.db.patch(row._id, { sessionsDone, percent, updatedAt: now });
    }
    // True only on the press that issues the badge, so a toast fires once.
    let badgeIssued = false;
    if (sessionsDone >= COURSE_SESSIONS) {
      const had = await badgeOf(ctx, viewer.person._id);
      // `issueBadge` returns the existing badge, so a second press adds nothing.
      await issueBadge(ctx, viewer.person, now);
      badgeIssued = !had;
    }
    return { sessionsDone, percent, badgeIssued };
  },
});
