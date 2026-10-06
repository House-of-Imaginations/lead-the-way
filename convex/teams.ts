import { v } from "convex/values";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import {
  AI_USE,
  CHALLENGES,
  INDUSTRIES,
  mustBeOneOf,
  TEAM_FUNCTIONS,
  TEAM_SIZES,
} from "./lib/setupOptions";
import { setupSprint, currentTeam, ensureSprint } from "./lib/sprint";
import { upsertAnswer } from "./lib/surveys";

/** The "Other" challenge's own words (03 page 2). */
const MAX_OTHER = 200;

/**
 * Screen 03, the team profile, and its norms baseline. `saved` is true once
 * page 2 was finished (`savedAt`); `normsConfidence` is the viewer's own
 * before rating on the current sprint, or null when they skipped it.
 */
export const current = viewerQuery("sprint:manage")({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      sizeBand: v.union(v.null(), v.string()),
      industry: v.union(v.null(), v.string()),
      teamFunction: v.union(v.null(), v.string()),
      aiUse: v.union(v.null(), v.string()),
      challenges: v.array(v.string()),
      challengeOther: v.union(v.null(), v.string()),
      saved: v.boolean(),
      normsConfidence: v.union(v.null(), v.number()),
    }),
  ),
  handler: async (ctx) => {
    const { viewer } = ctx;
    const team = await currentTeam(ctx, viewer.org._id);
    if (!team) return null;
    const sprint = await setupSprint(ctx, viewer.org._id);
    // At most six rows: two phases of three questions.
    const mine = sprint
      ? await ctx.db
          .query("surveyResponses")
          .withIndex("by_person_and_sprint", (q) =>
            q.eq("personId", viewer.person._id).eq("sprintId", sprint._id),
          )
          .collect()
      : [];
    const rating = mine.find(
      (r) => r.phase === "before" && r.question === "normsConfidence",
    );
    return {
      name: team.name,
      sizeBand: team.sizeBand ?? null,
      industry: team.industry ?? null,
      teamFunction: team.teamFunction ?? null,
      aiUse: team.aiUse ?? null,
      challenges: team.challenges,
      challengeOther: team.challengeOther ?? null,
      saved: team.savedAt !== undefined,
      normsConfidence: rating?.score ?? null,
    };
  },
});

/**
 * Save 03. Page 1's Continue and Save and exit pass `finish: false` (a draft);
 * page 2's Continue passes `finish: true`, which marks the team done once and
 * never moves that time. The whole profile is written each time, so a field
 * cleared on screen is cleared here. Setup still open after launch is fine:
 * the profile describes the team, not the sprint.
 */
export const saveProfile = viewerMutation("sprint:manage")({
  args: {
    sizeBand: v.optional(v.string()),
    industry: v.optional(v.string()),
    teamFunction: v.optional(v.string()),
    aiUse: v.optional(v.string()),
    challenges: v.array(v.string()),
    challengeOther: v.optional(v.string()),
    normsConfidence: v.optional(v.number()),
    finish: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { viewer } = ctx;
    mustBeOneOf(TEAM_SIZES, args.sizeBand, "Choose a team size from the list.");
    mustBeOneOf(INDUSTRIES, args.industry, "Choose an industry from the list.");
    mustBeOneOf(
      TEAM_FUNCTIONS,
      args.teamFunction,
      "Choose a team function from the list.",
    );
    mustBeOneOf(
      AI_USE.map((o) => o.label),
      args.aiUse,
      "Choose how your team uses AI from the list.",
    );
    for (const challenge of args.challenges) {
      mustBeOneOf(CHALLENGES, challenge, "Choose challenges from the list.");
    }
    const other = args.challengeOther?.trim() ?? "";
    if (other.length > MAX_OTHER) {
      throwUserError(
        "FIELD_REQUIRED",
        `Describe the other challenge in at most ${MAX_OTHER} characters.`,
      );
    }
    const score = args.normsConfidence;
    if (
      score !== undefined &&
      !(Number.isInteger(score) && score >= 1 && score <= 5)
    ) {
      throwUserError("FIELD_REQUIRED", "Choose a rating from 1 to 5.");
    }

    const team = await currentTeam(ctx, viewer.org._id);
    if (!team) throwUserError("NOT_FOUND", "That no longer exists.");
    const challenges = [...new Set(args.challenges)];
    await ctx.db.patch(team._id, {
      sizeBand: args.sizeBand,
      industry: args.industry,
      teamFunction: args.teamFunction,
      aiUse: args.aiUse,
      challenges,
      challengeOther: challenges.includes("Other") && other ? other : undefined,
      savedAt: args.finish ? (team.savedAt ?? viewer.now) : team.savedAt,
    });
    // Page 2's rating needs a sprint, and so does 04 next.
    const sprint = await ensureSprint(ctx, viewer);
    // The before rating is a baseline: it stops moving once the sprint launched.
    if (score !== undefined && sprint.launchedAt === undefined) {
      await upsertAnswer(ctx, {
        orgId: viewer.org._id,
        sprintId: sprint._id,
        personId: viewer.person._id,
        phase: "before",
        question: "normsConfidence",
        score,
        at: viewer.now,
      });
    }
    return null;
  },
});
