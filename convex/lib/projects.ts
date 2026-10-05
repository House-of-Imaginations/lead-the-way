import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { throwUserError } from "./errors";
import { launchedSprint } from "./sprint";
import type { Viewer } from "./viewer";

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

/** The viewer's saved project in the launched sprint, or PROJECT_NOT_SAVED (Rulings 12, 13 and 15). */
export async function savedProject(
  ctx: QueryCtx,
  viewer: Viewer,
): Promise<Doc<"projects">> {
  const sprint = await launchedSprint(ctx, viewer.org._id);
  const project = sprint
    ? await projectOf(ctx, viewer.person._id, sprint._id)
    : null;
  if (!project || project.status !== "saved") {
    throwUserError("PROJECT_NOT_SAVED", "Save your project first.");
  }
  return project;
}
