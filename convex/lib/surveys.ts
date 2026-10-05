import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SurveyQuestion } from "../tables/sprint";
import { closesAt, sprintPhase, weekOf } from "./sprintTime";

/**
 * Ruling 7: the after check-in is open from the last week (or once the sprint
 * is complete) until the sprint closes and its outcomes are taken (P7a Ruling
 * 9). An answer after that would go into a total that never changes again.
 * `surveys.checkIn` refuses outside it; `me.home` and the board show the card
 * only inside it. One rule, so a card never offers what the save refuses.
 */
export const afterCheckInOpen = (sprint: Doc<"sprints">, now: number) =>
  (sprintPhase(sprint, now) === "complete" ||
    weekOf(sprint, now) >= sprint.weeks) &&
  now < closesAt(sprint);

/**
 * Sprint 1 asks the before check-in at join, with no window, until the sprint
 * closes. Nothing is asked into a finished sprint: a join after it closes,
 * while the next sprint is still a draft, writes no rows into it (GC-M8). A
 * later sprint has no join, so it asks until the end of week 1 (P7a Ruling
 * 17). `me.home`, `joinFacts` and `surveys.checkIn` all read this one rule.
 */
export const beforeCheckInOpen = (
  sprint: Doc<"sprints">,
  later: boolean,
  now: number,
) => now < closesAt(sprint) && (!later || weekOf(sprint, now) <= 1);

/** The after check-in is answered. A skip (no `score`) is not an answer (Ruling 6). */
export const answeredAfter = (rows: Doc<"surveyResponses">[]) =>
  rows.some((r) => r.phase === "after" && r.score !== undefined);

/**
 * The before check-in is done: answered or skipped, since Ruling 6 writes a
 * skip as rows. `normsConfidence` is the manager's own question on 05, not
 * this check-in. `surveys.checkIn` refuses a second, and `me.home` offers the
 * card until this holds.
 */
export const answeredBefore = (rows: Doc<"surveyResponses">[]) =>
  rows.some((r) => r.phase === "before" && r.question !== "normsConfidence");

/**
 * One answer, one row per (person, sprint, phase, question) (writer contract
 * rule 5). A second answer replaces the score, and an answer replaces a skip
 * (Ruling 6). Nothing is logged, as the script's own answers log nothing for
 * Priya. The script reads first and skips an answer the tester gave, so it
 * never overwrites one.
 *
 * ponytail: `at` is taken but not stored for an answer, since only a skip
 * needs a time. Add one when a screen needs to say when somebody answered.
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
    if (row.score !== r.score || row.skippedAt !== undefined) {
      await ctx.db.patch(row._id, { score: r.score, skippedAt: undefined });
    }
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

/** The two questions a check-in asks (Ruling 7). */
const CHECK_IN = ["aiConfidence", "comfortWithManager"] as const;

/**
 * "Skip for now" (Ruling 6): a row per check-in question with `skippedAt` and
 * no `score`. The script reads rows before it answers, so it leaves a skip
 * alone, and no reader counts one as a response. A skip never replaces an
 * answer; `upsertAnswer` replaces a skip. Logs nothing: there was no answer.
 */
export async function recordSkip(
  ctx: MutationCtx,
  row: {
    orgId: Id<"orgs">;
    sprintId: Id<"sprints">;
    personId: Id<"people">;
    phase: "before" | "after";
    at: number;
  },
): Promise<void> {
  // At most six rows: two phases of three questions.
  const mine = await ctx.db
    .query("surveyResponses")
    .withIndex("by_person_and_sprint", (q) =>
      q.eq("personId", row.personId).eq("sprintId", row.sprintId),
    )
    .take(6);
  for (const question of CHECK_IN) {
    if (mine.some((a) => a.phase === row.phase && a.question === question)) {
      continue;
    }
    await ctx.db.insert("surveyResponses", {
      orgId: row.orgId,
      sprintId: row.sprintId,
      personId: row.personId,
      phase: row.phase,
      question,
      skippedAt: row.at,
    });
  }
}
