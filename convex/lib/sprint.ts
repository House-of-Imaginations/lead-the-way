import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { agreementSaved } from "./agreement";
import { throwUserError } from "./errors";
import { requiredDone } from "./pathway";
import { weekOneDate } from "./sprintTime";
import type { Viewer } from "./viewer";

export const DEFAULT_COURSE = "AI Productivity Fundamentals";

/** The workspace's one team (writer contract rule 1). */
export async function currentTeam(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<Doc<"teams"> | null> {
  // ponytail: one team per org is the writer contract; P7 must keep it or switch to `.first()`.
  return await ctx.db
    .query("teams")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
}

/** The newest sprint is the current one. P7's "Run another sprint" adds the next. */
export async function currentSprint(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<Doc<"sprints"> | null> {
  return await ctx.db
    .query("sprints")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .first();
}

/**
 * The current sprint, made as a draft the first time setup needs one: a
 * workspace starts with a team and no sprint (`createWorkspace`). Wednesday
 * 2:00 PM for an hour, four weeks, in the manager's time zone, from the next
 * working week.
 */
export async function ensureSprint(
  ctx: MutationCtx,
  viewer: Viewer,
): Promise<Doc<"sprints">> {
  const orgId = viewer.org._id;
  const found = await currentSprint(ctx, orgId);
  if (found) return found;
  const team = await currentTeam(ctx, orgId);
  if (!team) throwUserError("NOT_FOUND", "That no longer exists.");
  const now = viewer.now;
  const timeZone = viewer.person.timeZone;
  const id = await ctx.db.insert("sprints", {
    orgId,
    teamId: team._id,
    startDate: weekOneDate(3, now, timeZone),
    timeZone,
    weeks: 4,
    protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
    courseTitle: DEFAULT_COURSE,
    createdAt: now,
  });
  const sprint = await ctx.db.get(id);
  if (!sprint) throw new Error("just-inserted sprint is missing");
  return sprint;
}

/** Where setup stands: the 03 checklist and the 07 launch gate read these. */
export type SetupGate = {
  teamSaved: boolean;
  committed: boolean;
  pathwayDone: boolean;
  agreementSaved: boolean;
};

export async function setupGate(
  ctx: QueryCtx,
  viewer: Viewer,
  team: Doc<"teams"> | null,
  sprint: Doc<"sprints"> | null,
): Promise<SetupGate> {
  return {
    teamSaved: team?.savedAt !== undefined,
    committed: sprint?.committedAt !== undefined,
    pathwayDone: await requiredDone(ctx, viewer.person._id),
    agreementSaved: team !== null && (await agreementSaved(ctx, team)),
  };
}

/** Launch's condition. It never asks for the team profile. */
export const gateOpen = (g: SetupGate) =>
  g.committed && g.pathwayDone && g.agreementSaved;

/** Setup edits stop at launch (spec 3.3, "soft order, hard launch"). */
export function requireDraft(sprint: Doc<"sprints">): void {
  if (sprint.launchedAt !== undefined) {
    throwUserError("SPRINT_LAUNCHED", "Your sprint has already launched.");
  }
}
