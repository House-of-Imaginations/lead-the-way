import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { crewOf, settingsFor } from "./lib/careers/crew";
import {
  authenticatedMutation,
  authenticatedQuery,
} from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { ownerOf } from "./lib/orgs/people";
import { thresholdOf } from "./lib/privacy";
import { settingsOf, writeSettings } from "./lib/settings";
import { getAccount } from "./lib/viewer";

/**
 * MS4 Privacy by track (spec 5.4). X4: every function acts on the signed-in
 * account's own tracks and takes no person id. The team column is three of
 * 19's toggles on the seat's `settings`; the 5-response threshold is the
 * workspace's, shown read-only. The career column is three of D8's
 * career settings, the same fields `careerSettings.set` writes.
 */

const TEAM_KEYS = [
  "askBeforeSharing",
  "reflectionsOnCredential",
  "includeInTeamTotals",
] as const;
const CAREER_KEYS = [
  "showDoneToCrew",
  "guideSeesProgress",
  "reflectionOnProof",
] as const;

const pick = <K extends string>(keys: readonly K[], row: Record<K, boolean>) =>
  Object.fromEntries(keys.map((k) => [k, row[k]])) as Record<K, boolean>;

export const byTrack = authenticatedQuery({
  args: {},
  returns: v.object({
    team: v.union(
      v.null(),
      v.object({
        orgName: v.string(),
        manager: v.union(v.null(), v.string()),
        threshold: v.number(),
        settings: v.object({
          askBeforeSharing: v.boolean(),
          reflectionsOnCredential: v.boolean(),
          includeInTeamTotals: v.boolean(),
        }),
      }),
    ),
    career: v.union(
      v.null(),
      v.object({
        private: v.boolean(),
        guide: v.union(v.null(), v.string()),
        settings: v.object({
          showDoneToCrew: v.boolean(),
          guideSeesProgress: v.boolean(),
          reflectionOnProof: v.boolean(),
        }),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { team, career } = await getAccount(ctx);
    if (!team && !career) {
      throwUserError("NO_CAREER_TRACK", "Start a track first.");
    }
    let teamPart = null;
    if (team) {
      teamPart = {
        orgName: team.org.name,
        manager: (await ownerOf(ctx, team.org._id))?.firstName ?? null,
        threshold: thresholdOf(team.org),
        settings: pick(TEAM_KEYS, await settingsOf(ctx, team.person._id)),
      };
    }
    let careerPart = null;
    if (career) {
      const [row, crew] = await Promise.all([
        settingsFor(ctx, career.profile._id),
        crewOf(ctx, career.profile),
      ]);
      if (!row) throwUserError("NOT_FOUND", "That no longer exists.");
      const guide = crew && (await ctx.db.get(crew.guideId));
      careerPart = {
        private: career.profile.private,
        guide: guide?.firstName ?? null,
        settings: pick(CAREER_KEYS, row),
      };
    }
    return { team: teamPart, career: careerPart };
  },
});

/** A team toggle, saved at once. `expectOrgId` as `viewerMutation` takes it (R6). */
export const setTeam = authenticatedMutation({
  args: {
    key: literals(...TEAM_KEYS),
    on: v.boolean(),
    expectOrgId: v.id("orgs"),
  },
  returns: v.null(),
  handler: async (ctx, { key, on, expectOrgId }) => {
    const { team } = await getAccount(ctx);
    if (!team) {
      throwUserError("NO_WORKSPACE", "Set up or join a workspace first.");
    }
    if (team.org._id !== expectOrgId) {
      throwUserError(
        "WORKSPACE_CHANGED",
        "You switched workspace in another tab. Reload the page to continue.",
      );
    }
    await writeSettings(ctx, team.person, { [key]: on });
    return null;
  },
});

/** A career toggle, saved at once, on the same row `careerSettings.set` writes. */
export const setCareer = authenticatedMutation({
  args: { key: literals(...CAREER_KEYS), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { key, on }) => {
    const { career } = await getAccount(ctx);
    if (!career) {
      throwUserError("NO_CAREER_TRACK", "Start a Change careers track first.");
    }
    const row = await settingsFor(ctx, career.profile._id);
    if (!row) throwUserError("NOT_FOUND", "That no longer exists.");
    await ctx.db.patch(row._id, { [key]: on });
    return null;
  },
});
