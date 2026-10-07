import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { MAX_TEAM_NAME, orgNameOf } from "./lib/orgs/create";
import { grants } from "./lib/orgs/permissions";
import { thresholdOf } from "./lib/privacy";
import { TIME_ZONES } from "./lib/profileFields";
import {
  INDUSTRIES,
  TEAM_FUNCTIONS,
  THRESHOLDS,
  mustBeOneOf,
} from "./lib/setupOptions";
import {
  checkHour,
  currentTeam,
  DEFAULT_COURSE,
  draftHour,
  setupSprint,
  sprintDefaultsOf,
} from "./lib/sprint";

/**
 * 18, Workspace settings (P7b-2). Workspace fields live on `orgs` and the
 * team's on `teams`. The whole page needs `org:manage` (decision 1). It names
 * nobody: the owner tag reads the shell's `workspaceSettings.owner`.
 */
export const settings = viewerQuery("org:manage")({
  args: {},
  returns: v.object({
    orgId: v.id("orgs"),
    name: v.string(),
    /** The Workspace ID. Links use it, so it never changes. */
    slug: v.string(),
    partner: v.union(v.null(), v.string()),
    teamName: v.string(),
    industry: v.union(v.null(), v.string()),
    teamFunction: v.union(v.null(), v.string()),
    course: v.string(),
    threshold: v.number(),
    sprintDefaults: v.object({
      weekday: v.number(),
      start: v.string(),
      timeZone: v.string(),
    }),
    /** Sprint defaults' Save needs sprint:manage too (`saveSprintDefaults`). */
    canSetDefaults: v.boolean(),
  }),
  handler: async (ctx) => {
    const { org, permissions } = ctx.viewer;
    const team = await currentTeam(ctx, org._id);
    return {
      // R-g: the tabs show only their own workspace's settings.
      orgId: org._id,
      name: org.name,
      slug: org.slug,
      partner: org.partnerName
        ? `${org.partnerName}, delivered with IBM SkillsBuild`
        : null,
      teamName: team?.name ?? "",
      industry: team?.industry ?? null,
      teamFunction: team?.teamFunction ?? null,
      course: DEFAULT_COURSE,
      threshold: thresholdOf(org),
      sprintDefaults: await sprintDefaultsOf(
        ctx,
        org,
        ctx.viewer.person.timeZone,
      ),
      canSetDefaults: grants(permissions, ["sprint:manage"]),
    };
  },
});

/**
 * Data and privacy's small-group threshold (spec rule 3). It applies at once
 * (decision 3): `statOf` reads a stored row against the higher of its own
 * threshold and this one, and a row stored hidden has no value to show when
 * it is lowered. It never touches a stored row, so Ruling FX holds.
 * Live facts, such as the agreement's 'Signed by the team', follow today's
 * threshold both ways. 'Never reveals' governs stored totals.
 */
export const setThreshold = viewerMutation("org:manage")({
  args: { threshold: v.number() },
  returns: v.null(),
  handler: async (ctx, { threshold }): Promise<null> => {
    // `includes` is false for 4, 11, 5.5 and NaN alike.
    if (!(THRESHOLDS as readonly number[]).includes(threshold)) {
      throwUserError("FIELD_REQUIRED", "Choose a threshold from 5 to 10.");
    }
    await ctx.db.patch(ctx.viewer.org._id, { privacyThreshold: threshold });
    return null;
  },
});

/**
 * General's Save changes. The workspace name is on `orgs` (the slug never
 * changes: links already use it), and the team's name and profile on its one
 * `teams` row. Partner program and Workspace ID are read-only.
 */
export const saveGeneral = viewerMutation("org:manage")({
  args: {
    name: v.string(),
    teamName: v.string(),
    industry: v.optional(v.string()),
    teamFunction: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const orgId = ctx.viewer.org._id;
    const name = orgNameOf(args.name);
    const teamName = args.teamName.trim();
    if (!teamName) throwUserError("NAME_REQUIRED", "A team needs a name.");
    if (teamName.length > MAX_TEAM_NAME) {
      throwUserError(
        "NAME_REQUIRED",
        `A team name can be at most ${MAX_TEAM_NAME} characters.`,
      );
    }
    mustBeOneOf(INDUSTRIES, args.industry, "Choose an industry from the list.");
    mustBeOneOf(
      TEAM_FUNCTIONS,
      args.teamFunction,
      "Choose a team function from the list.",
    );
    const team = await currentTeam(ctx, orgId);
    if (!team) throwUserError("NOT_FOUND", "That no longer exists.");
    await ctx.db.patch(orgId, { name });
    await ctx.db.patch(team._id, {
      name: teamName,
      industry: args.industry,
      teamFunction: args.teamFunction,
    });
    return null;
  },
});

/**
 * Sprint defaults' Save changes. They own the day, start and zone a new
 * sprint starts from, and an open draft takes them too, keeping its
 * commitment. A launched sprint never does: its runs are scheduled in its own
 * zone (R-h). Never makes a sprint (writer contract: one draft, the newest).
 * Writes a sprint, so it needs sprint:manage as well (decision 5).
 */
export const saveSprintDefaults = viewerMutation(
  "org:manage",
  "sprint:manage",
)({
  args: {
    weekday: v.number(),
    start: v.string(),
    timeZone: literals(...TIME_ZONES),
  },
  returns: v.null(),
  handler: async (ctx, { weekday, start, timeZone }): Promise<null> => {
    checkHour(weekday, start);
    const { org } = ctx.viewer;
    await ctx.db.patch(org._id, {
      sprintDefaults: { weekday, start, timeZone },
    });
    const draft = await setupSprint(ctx, org._id);
    if (draft && draft.launchedAt === undefined) {
      await ctx.db.patch(draft._id, {
        ...draftHour({ ...draft, timeZone }, ctx.viewer.now, weekday, start),
        timeZone,
      });
    }
    return null;
  },
});
