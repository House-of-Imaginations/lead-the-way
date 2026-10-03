import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Ruling 4: presented exactly when saved, shared with the team and given a
 * time. Pressing "Present to team" sets all three, so a draft or a saved
 * project nobody presented is never anybody else's to read. The board, the
 * canary and P7's counts read this.
 */
export const isPresented = (p: Doc<"projects">): boolean =>
  p.status === "saved" && p.sharing === "team" && p.presentedAt !== undefined;

/** A person's one project in a sprint (writer contract rule 5). */
export async function projectOf(
  ctx: QueryCtx,
  personId: Id<"people">,
  sprintId: Id<"sprints">,
): Promise<Doc<"projects"> | null> {
  return await ctx.db
    .query("projects")
    .withIndex("by_person_and_sprint", (q) =>
      q.eq("personId", personId).eq("sprintId", sprintId),
    )
    .unique();
}
