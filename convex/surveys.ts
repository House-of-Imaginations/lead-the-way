import { v } from "convex/values";
import { viewerMutation } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { logEvent } from "./lib/events";
import { currentSprint } from "./lib/sprint";
import {
  afterCheckInOpen,
  answeredAfter,
  recordSkip,
  upsertAnswer,
} from "./lib/surveys";
import { phaseValidator } from "./tables/sprint";

/**
 * The two employee check-ins (Ruling 7). Before: once, right after joining,
 * and skippable; a skip writes rows (Ruling 6) so the script leaves it alone,
 * and logs nothing, because a skip is not an answer. After: from week 4 until
 * answered, no skip. Rows are the viewer's own; nobody else reads them here.
 */
export const checkIn = viewerMutation()({
  args: {
    phase: phaseValidator,
    answers: v.union(
      v.null(),
      v.object({ aiConfidence: v.number(), comfortWithManager: v.number() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { phase, answers }): Promise<null> => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;
    const sprint = await currentSprint(ctx, orgId);
    if (!sprint) throwUserError("NO_SPRINT", "Your team has no sprint yet.");
    const now = viewer.now;
    const row = {
      orgId,
      sprintId: sprint._id,
      personId: viewer.person._id,
      phase,
      at: now,
    };

    // At most six rows: two phases of three questions.
    const mine = await ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", viewer.person._id).eq("sprintId", sprint._id),
      )
      .take(6);
    if (phase === "before") {
      // normsConfidence is the manager's own (05), not this check-in.
      if (
        mine.some(
          (r) => r.phase === "before" && r.question !== "normsConfidence",
        )
      ) {
        throwUserError(
          "CHECK_IN_DONE",
          "You've already answered the before check-in.",
        );
      }
    } else if (!afterCheckInOpen(sprint, now)) {
      throwUserError(
        "CHECK_IN_CLOSED",
        `The after check-in opens in week ${sprint.weeks}.`,
      );
    }

    if (phase === "after" && answeredAfter(mine)) {
      throwUserError(
        "CHECK_IN_DONE",
        "You've already answered the after check-in.",
      );
    }
    if (!answers) {
      if (phase === "after") {
        throwUserError("FIELD_REQUIRED", "Answer both questions to save.");
      }
      await recordSkip(ctx, row);
      return null;
    }
    const { aiConfidence, comfortWithManager } = answers;
    for (const score of [aiConfidence, comfortWithManager]) {
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throwUserError(
          "FIELD_REQUIRED",
          "Pick a number from 1 to 5 for each question.",
        );
      }
    }
    await upsertAnswer(ctx, {
      ...row,
      question: "aiConfidence",
      score: aiConfidence,
    });
    await upsertAnswer(ctx, {
      ...row,
      question: "comfortWithManager",
      score: comfortWithManager,
    });
    // As the script's `checkIn` logs it.
    await logEvent(ctx, {
      orgId,
      sprintId: sprint._id,
      type: "survey.answered",
      at: now,
      meta: { phase },
    });
    return null;
  },
});
