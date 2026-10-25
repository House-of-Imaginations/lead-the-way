import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { crewOf, learnerOf, projectFor } from "../lib/careers/crew";
import { careerMutation, careerQuery } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { initialsOf } from "../lib/initials";
import type { Career } from "../lib/viewer";

/**
 * 5b Crew demo day. `session` lists only the projects their owners chose to
 * present (a `presentations` row exists only once they press Present), and
 * shows each by first name, initials and task: never progress or scores.
 */

const MAX_REFLECTION = 2000;

/** The caller's own project for the crew's credential, or NOT_FOUND. */
async function myProject(ctx: MutationCtx, career: Career) {
  const profile = learnerOf(career);
  const crew = await crewOf(ctx, profile);
  const project = await projectFor(ctx, profile._id, crew?.credentialId);
  if (!project) {
    throwUserError("NOT_FOUND", "Start your project first.");
  }
  return { profile, crew, project };
}

export const session = careerQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      at: v.number(),
      mine: v.union(
        v.null(),
        v.object({
          task: v.string(),
          whatIDid: v.string(),
          reflection: v.string(),
          addReflectionToProof: v.boolean(),
          reviewedBy: v.union(v.null(), v.string()),
        }),
      ),
      presenting: v.array(
        v.object({
          firstName: v.string(),
          initials: v.string(),
          task: v.string(),
          you: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    const crew = await crewOf(ctx, profile);
    if (!crew) return null;
    const day = await ctx.db
      .query("demoDays")
      .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
      .first();
    if (!day) return null;
    const own =
      profile.kind === "learner"
        ? await projectFor(ctx, profile._id, crew.credentialId)
        : null;
    const reviewer = own?.reviewedBy && (await ctx.db.get(own.reviewedBy));
    const rows = await ctx.db
      .query("presentations")
      .withIndex("by_demoDay", (q) => q.eq("demoDayId", day._id))
      .take(50);
    const presenting = [];
    for (const row of rows) {
      const [owner, project] = await Promise.all([
        ctx.db.get(row.careerProfileId),
        ctx.db.get(row.projectId),
      ]);
      if (!owner || !project) continue;
      presenting.push({
        firstName: owner.firstName,
        initials: initialsOf(owner.firstName),
        task: project.task,
        you: owner._id === profile._id,
      });
    }
    return {
      at: day.at,
      mine: own && {
        task: own.task,
        whatIDid: own.whatIDid,
        reflection: own.reflection,
        addReflectionToProof: own.addReflectionToProof,
        reviewedBy: reviewer ? reviewer.firstName : null,
      },
      presenting,
    };
  },
});

/** What I learned: autosaved as the learner types. */
export const saveReflection = careerMutation({
  args: { reflection: v.string() },
  returns: v.null(),
  handler: async (ctx, { reflection }) => {
    if (reflection.length > MAX_REFLECTION) {
      throwUserError(
        "PROJECT_TOO_LONG",
        `Keep your reflection to ${MAX_REFLECTION} characters or fewer.`,
      );
    }
    const { project } = await myProject(ctx, ctx.career);
    await ctx.db.patch(project._id, { reflection });
    return null;
  },
});

/** Add this reflection to my proof (P5's second switch). */
export const setAddToProof = careerMutation({
  args: { on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { on }) => {
    const { project } = await myProject(ctx, ctx.career);
    await ctx.db.patch(project._id, { addReflectionToProof: on });
    return null;
  },
});

/** Present to my crew: the learner chooses to show their project. Repeats are a no-op. */
export const present = careerMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { profile, crew, project } = await myProject(ctx, ctx.career);
    const day =
      crew &&
      (await ctx.db
        .query("demoDays")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .first());
    if (!day) {
      throwUserError("NOT_FOUND", "Your crew has no demo day yet.");
    }
    const mine = await ctx.db
      .query("presentations")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .take(10);
    if (mine.some((p) => p.demoDayId === day._id)) return null;
    await ctx.db.insert("presentations", {
      demoDayId: day._id,
      projectId: project._id,
      careerProfileId: profile._id,
      presentedAt: ctx.career.now,
    });
    return null;
  },
});
