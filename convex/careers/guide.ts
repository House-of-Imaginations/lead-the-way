import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { lessonsFor } from "../lib/careers/catalog";
import {
  crewOf,
  doneLessons,
  guideOf,
  membersOf,
  projectFor,
  settingsFor,
  weeklyOf,
} from "../lib/careers/crew";
import { careerMutation, careerQuery } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { initialsOf } from "../lib/initials";
import type { Career } from "../lib/viewer";
import { credentialId } from "../tables/careers";

/**
 * The Pathway Guide's people (P3). A guide sees each learner's lesson
 * progress only while `guideSeesProgress` is on, and otherwise the weekly
 * word P2 gives the crew (none when `showDoneToCrew` is off). Never the
 * current role, hours, protected days, confidence or research answers.
 */

const MAX_ENDORSEMENT = 500;

/** A learner in the caller's own crew, or NOT_FOUND: a guide reaches no one else. */
async function myLearner(
  ctx: MutationCtx,
  career: Career,
  careerProfileId: Id<"careerProfiles">,
) {
  const crew = await crewOf(ctx, guideOf(career));
  const learner =
    crew &&
    (await membersOf(ctx, crew._id)).find((p) => p._id === careerProfileId);
  if (!learner) throwUserError("NOT_FOUND", "That no longer exists.");
  return learner;
}

export const myLearners = careerQuery({
  args: {},
  returns: v.array(
    v.object({
      careerProfileId: v.id("careerProfiles"),
      firstName: v.string(),
      initials: v.string(),
      weekly: v.union(
        v.null(),
        v.literal("done"),
        v.literal("back"),
        v.literal("notYet"),
      ),
      progress: v.union(
        v.null(),
        v.object({ done: v.number(), total: v.number() }),
      ),
      project: v.union(
        v.null(),
        v.object({
          projectId: v.id("careerProjects"),
          task: v.string(),
          reviewed: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const crew = await crewOf(ctx, guideOf(ctx.career));
    if (!crew) return [];
    const now = ctx.career.now;
    const lessons = new Set(lessonsFor(crew.credentialId).map((l) => l.id));
    return await Promise.all(
      (await membersOf(ctx, crew._id)).map(async (p) => {
        const [settings, progress, project] = await Promise.all([
          settingsFor(ctx, p._id),
          doneLessons(ctx, p._id),
          projectFor(ctx, p._id, crew.credentialId),
        ]);
        return {
          careerProfileId: p._id,
          firstName: p.firstName,
          initials: initialsOf(p.firstName),
          weekly: settings?.showDoneToCrew
            ? weeklyOf(crew, progress, now)
            : null,
          progress: settings?.guideSeesProgress
            ? {
                done: progress.filter((l) => lessons.has(l.lessonId)).length,
                total: lessons.size,
              }
            : null,
          project: project && {
            projectId: project._id,
            task: project.task,
            reviewed: project.reviewedAt !== undefined,
          },
        };
      }),
    );
  },
});

/** The guide's endorsement of one credential; a second one replaces the first. */
export const endorse = careerMutation({
  args: {
    careerProfileId: v.id("careerProfiles"),
    credentialId,
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { careerProfileId, credentialId, text }) => {
    const learner = await myLearner(ctx, ctx.career, careerProfileId);
    const words = text.trim();
    if (!words || words.length > MAX_ENDORSEMENT) {
      throwUserError(
        "FIELD_REQUIRED",
        `Write an endorsement of ${MAX_ENDORSEMENT} characters or fewer.`,
      );
    }
    const rows = await ctx.db
      .query("endorsements")
      .withIndex("by_user", (q) => q.eq("userId", learner.userId))
      .take(20);
    const row = rows.find(
      (e) =>
        e.credentialId === credentialId && e.guideId === ctx.career.profile._id,
    );
    if (row) await ctx.db.patch(row._id, { text: words });
    else
      await ctx.db.insert("endorsements", {
        userId: learner.userId,
        guideId: ctx.career.profile._id,
        credentialId,
        text: words,
      });
    return null;
  },
});

/** Reviewed by Lena: the guide marks a crew member's project reviewed. */
export const reviewProject = careerMutation({
  args: { projectId: v.id("careerProjects") },
  returns: v.null(),
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project) throwUserError("NOT_FOUND", "That no longer exists.");
    await myLearner(ctx, ctx.career, project.careerProfileId);
    await ctx.db.patch(projectId, {
      reviewedBy: ctx.career.profile._id,
      reviewedAt: ctx.career.now,
    });
    return null;
  },
});
