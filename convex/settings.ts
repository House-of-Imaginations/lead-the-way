import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { saveDisplayName } from "./lib/account/profile";
import { throwUserError } from "./lib/errors";
import { updateSeatProfile } from "./lib/orgs/membership";
import { firstNameOf, initialsOf } from "./lib/orgs/people";
import { MAX_JOB_TITLE, TIME_ZONES } from "./lib/profileFields";
import { thresholdOf } from "./lib/privacy";
import { settingsOf, writeSettings, type Settings } from "./lib/settings";

/**
 * 17 and 19 (P7b-1): a person's own settings. Every function here reads and
 * writes the viewer's own rows only. The one other person named is the
 * workspace owner, by name, with no number beside it.
 */

const settingsValidator = v.object({
  weeklyReminder: v.boolean(),
  showAndTellReminder: v.boolean(),
  askBeforeSharing: v.boolean(),
  reflectionsOnCredential: v.boolean(),
  includeInTeamTotals: v.boolean(),
  captionsByDefault: v.boolean(),
  reduceMotion: v.boolean(),
});

/** The settings that save at once, with a toast (spec 7.2). */
const toggleKeyValidator = literals(
  "weeklyReminder",
  "showAndTellReminder",
  "askBeforeSharing",
  "reflectionsOnCredential",
  "includeInTeamTotals",
);

/**
 * Who 19 says manages the workspace: the earliest-seated holder of the owner
 * role (Ruling 14). ponytail: one name; P7b-3's Members tab lists every owner.
 */
async function managerOf(ctx: QueryCtx, orgId: Id<"orgs">) {
  // ponytail: a workspace holds a handful of roles; 100 is the ceiling.
  const roles = await ctx.db
    .query("orgRoles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(100);
  const owner = roles.find((role) => role.kind === "owner");
  if (!owner) return null;
  const person = await ctx.db
    .query("people")
    .withIndex("by_role", (q) => q.eq("roleId", owner._id))
    .first();
  return person && { name: person.name, firstName: firstNameOf(person.name) };
}

export const mine = viewerQuery()({
  args: {},
  returns: v.object({
    name: v.string(),
    email: v.string(),
    jobTitle: v.string(),
    timeZone: v.string(),
    manager: v.union(
      v.null(),
      v.object({ name: v.string(), firstName: v.string() }),
    ),
    /** "Hidden when fewer than 5 people respond", from the workspace's own threshold. */
    threshold: v.number(),
    settings: settingsValidator,
  }),
  handler: async (ctx) => {
    const { viewer } = ctx;
    const { person } = viewer;
    return {
      name: person.name,
      email: person.email,
      jobTitle: person.jobTitle,
      timeZone: person.timeZone,
      manager: await managerOf(ctx, viewer.org._id),
      threshold: thresholdOf(viewer.org),
      settings: await settingsOf(ctx, person._id),
    };
  },
});

/** Notifications and 19's Privacy and sharing: one switch, saved at once. */
export const setToggle = viewerMutation()({
  args: { key: toggleKeyValidator, on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { key, on }) => {
    const patch: Partial<Settings> = {};
    patch[key] = on;
    await writeSettings(ctx, ctx.viewer.person, patch);
    return null;
  },
});

/**
 * Profile's Save changes (17 and 19). The name is written to the seat, which
 * every view of this workspace reads, and to the account, which the next
 * workspace joined starts from (Ruling 5). Email is read-only (Ruling 6).
 * The zone is the person's own: it never moves a sprint, whose snapshot and
 * reminder runs are scheduled in the sprint's zone (R-h).
 */
export const saveProfile = viewerMutation()({
  args: {
    name: v.string(),
    jobTitle: v.string(),
    // R-h: a half-hour zone is refused by the validator itself.
    timeZone: literals(...TIME_ZONES),
    captionsByDefault: v.boolean(),
    reduceMotion: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { viewer } = ctx;
    const name = await saveDisplayName(ctx, viewer.userId, args.name);
    const jobTitle = args.jobTitle.trim();
    if (jobTitle.length > MAX_JOB_TITLE) {
      throwUserError(
        "FIELD_REQUIRED",
        `A job title can be at most ${MAX_JOB_TITLE} characters.`,
      );
    }
    await updateSeatProfile(ctx, viewer.person, {
      name,
      initials: initialsOf(name),
      jobTitle,
      timeZone: args.timeZone,
    });
    await writeSettings(ctx, viewer.person, {
      captionsByDefault: args.captionsByDefault,
      reduceMotion: args.reduceMotion,
    });
    return null;
  },
});
