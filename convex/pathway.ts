import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { logEvent } from "./lib/events";
import {
  PATHWAY_MODULES,
  coachingPercent,
  moduleKeyValidator,
  requiredDone,
} from "./lib/pathway";
import { currentSprint, ensureSprint } from "./lib/sprint";
import { upsertAnswer } from "./lib/surveys";
import { SURVEY_QUESTIONS } from "./tables/sprint";

/**
 * The manager's own pathway (05). Modules complete in order within each path,
 * and completing one credits its full minutes (Ruling 25). What the manager
 * watched is theirs: nothing here reads another person's rows.
 */

/** One row per module (writer contract 5), so seven at most. */
async function progressOf(ctx: QueryCtx, personId: Id<"people">) {
  return await ctx.db
    .query("pathwayProgress")
    .withIndex("by_person_and_module", (q) => q.eq("personId", personId))
    .take(PATHWAY_MODULES.length);
}

export const forViewer = viewerQuery("sprint:manage")({
  args: {},
  returns: v.object({
    modules: v.array(
      v.object({
        key: moduleKeyValidator,
        pathway: literals("required", "coaching"),
        minutes: v.number(),
        done: v.boolean(),
        unlocked: v.boolean(),
      }),
    ),
    required: v.object({ done: v.number(), total: v.number() }),
    coachingPercent: v.number(),
    afterConfidence: v.union(v.null(), v.number()),
    /** Ruling 16: after launch, 05's panel leads to the overview. */
    launched: v.boolean(),
  }),
  handler: async (ctx) => {
    const { viewer } = ctx;
    const rows = await progressOf(ctx, viewer.person._id);
    // A module is unlocked once every earlier module in its path is done.
    const open = { required: true, coaching: true };
    const modules = PATHWAY_MODULES.map((m) => {
      const done = rows.some(
        (r) => r.moduleKey === m.key && r.completedAt !== undefined,
      );
      const unlocked = done || open[m.pathway];
      if (!done) open[m.pathway] = false;
      return {
        key: m.key,
        pathway: m.pathway,
        minutes: m.minutes,
        done,
        unlocked,
      };
    });
    const required = modules.filter((m) => m.pathway === "required");

    const sprint = await currentSprint(ctx, viewer.org._id);
    // One row per phase and question (writer contract 5).
    const answers = sprint
      ? await ctx.db
          .query("surveyResponses")
          .withIndex("by_person_and_sprint", (q) =>
            q.eq("personId", viewer.person._id).eq("sprintId", sprint._id),
          )
          .take(SURVEY_QUESTIONS.length * 2)
      : [];
    const after = answers.find(
      (a) => a.phase === "after" && a.question === "normsConfidence",
    );
    return {
      modules,
      required: {
        done: required.filter((m) => m.done).length,
        total: required.length,
      },
      coachingPercent: coachingPercent(rows),
      afterConfidence: after?.score ?? null,
      launched: sprint?.launchedAt !== undefined,
    };
  },
});

export const completeModule = viewerMutation("sprint:manage")({
  args: { moduleKey: moduleKeyValidator },
  returns: v.null(),
  handler: async (ctx, { moduleKey }) => {
    const { viewer } = ctx;
    const rows = await progressOf(ctx, viewer.person._id);
    const done = (key: string) =>
      rows.some((r) => r.moduleKey === key && r.completedAt !== undefined);
    if (done(moduleKey)) return null;

    const index = PATHWAY_MODULES.findIndex((m) => m.key === moduleKey);
    const target = PATHWAY_MODULES[index];
    if (!target) throwUserError("NOT_FOUND", "That module no longer exists.");
    const blocked = PATHWAY_MODULES.slice(0, index).some(
      (m) => m.pathway === target.pathway && !done(m.key),
    );
    if (blocked) {
      throwUserError("FORBIDDEN", "Finish the earlier modules first.");
    }

    const now = viewer.now;
    const row = rows.find((r) => r.moduleKey === moduleKey);
    if (row) {
      await ctx.db.patch(row._id, {
        minutesWatched: Math.max(row.minutesWatched, target.minutes),
        completedAt: now,
      });
    } else {
      await ctx.db.insert("pathwayProgress", {
        orgId: viewer.org._id,
        personId: viewer.person._id,
        moduleKey,
        minutesWatched: target.minutes,
        completedAt: now,
      });
    }
    const sprint = await currentSprint(ctx, viewer.org._id);
    await logEvent(ctx, {
      orgId: viewer.org._id,
      sprintId: sprint?._id,
      type: "pathway.completed",
      at: now,
      meta: { moduleKey },
    });
    return null;
  },
});

/** "Ready to launch?" (spec 7.1). No call at all is how a skip is recorded. */
export const rateConfidence = viewerMutation("sprint:manage")({
  args: { score: v.number() },
  returns: v.null(),
  handler: async (ctx, { score }) => {
    const { viewer } = ctx;
    if (!(await requiredDone(ctx, viewer.person._id))) {
      throwUserError("FORBIDDEN", "Finish the required modules first.");
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throwUserError("FIELD_REQUIRED", "Pick a score from 1 to 5.");
    }
    const sprint = await ensureSprint(ctx, viewer);
    await upsertAnswer(ctx, {
      orgId: viewer.org._id,
      sprintId: sprint._id,
      personId: viewer.person._id,
      phase: "after",
      question: "normsConfidence",
      score,
      at: viewer.now,
    });
    return null;
  },
});
