import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SurveyQuestion } from "../tables/sprint";

/**
 * One answer, one row per (person, sprint, phase, question) (writer contract
 * rule 5). A second answer replaces the score; nothing is logged, as the
 * script's own answers log nothing for Priya. The script reads first and
 * skips an answer the tester gave, so it never overwrites one.
 *
 * ponytail: `at` is taken but not stored, since `surveyResponses` has no time
 * column. Add one when a screen needs to say when somebody answered.
 */
export async function upsertAnswer(
  ctx: MutationCtx,
  r: {
    orgId: Id<"orgs">;
    sprintId: Id<"sprints">;
    personId: Id<"people">;
    phase: "before" | "after";
    question: SurveyQuestion;
    score: number;
    at: number;
  },
): Promise<void> {
  // At most six rows: two phases of three questions.
  const mine = await ctx.db
    .query("surveyResponses")
    .withIndex("by_person_and_sprint", (q) =>
      q.eq("personId", r.personId).eq("sprintId", r.sprintId),
    )
    .collect();
  const row = mine.find(
    (a) => a.phase === r.phase && a.question === r.question,
  );
  if (row) {
    if (row.score !== r.score) await ctx.db.patch(row._id, { score: r.score });
    return;
  }
  await ctx.db.insert("surveyResponses", {
    orgId: r.orgId,
    sprintId: r.sprintId,
    personId: r.personId,
    phase: r.phase,
    question: r.question,
    score: r.score,
  });
}
