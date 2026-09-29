import { v } from "convex/values";
import schema from "./schema";
import { throwUserError } from "./lib/errors";
import {
  authenticatedMutation,
  orgMutation,
  publicQuery,
} from "./lib/customFunctions";
import { MAX_DISPLAY_NAME, profileOf } from "./lib/account/profile";
import { ensureProfile, setActiveOrgOf } from "./lib/account/ensureProfile";

/**
 * The account-level record. Auth owns identity; this owns the display name and
 * the workspace the app opens. Everything a workspace says about a person is
 * on their `people` row.
 */

export const me = publicQuery({
  args: {},
  returns: v.union(v.null(), schema.doc("profiles")),
  handler: async (ctx) =>
    ctx.userId ? await profileOf(ctx, ctx.userId) : null,
});

/** Create or rename this account's profile. */
export const saveProfile = authenticatedMutation({
  args: { displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, { displayName }): Promise<null> => {
    const name = displayName.trim();
    if (!name) throwUserError("NAME_REQUIRED", "A name is required.");
    if (name.length > MAX_DISPLAY_NAME) {
      throwUserError(
        "NAME_REQUIRED",
        `A name can be at most ${MAX_DISPLAY_NAME} characters.`,
      );
    }
    const profile = await ensureProfile(ctx, ctx.userId);
    await ctx.db.patch(profile._id, { displayName: name });
    return null;
  },
});

/** Open this workspace next time. Requires a seat in it. */
export const setActiveOrg = orgMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await setActiveOrgOf(ctx, ctx.userId, ctx.orgId);
    return null;
  },
});
