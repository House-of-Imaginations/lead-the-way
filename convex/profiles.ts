import { v } from "convex/values";
import schema from "./schema";
import { authenticatedMutation, publicQuery } from "./lib/customFunctions";
import { profileOf, saveDisplayName } from "./lib/account/profile";
import { setActiveOrgOf } from "./lib/account/ensureProfile";
import { seatOf } from "./lib/orgs/membership";

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
    await saveDisplayName(ctx, ctx.userId, displayName);
    return null;
  },
});

/**
 * Open this workspace next time. It names a workspace other than the open
 * one, so there is no workspace check to pass: the seat is checked here, and
 * NOT_A_MEMBER also covers "no such workspace".
 */
export const setActiveOrg = authenticatedMutation({
  args: { orgId: v.id("orgs") },
  returns: v.null(),
  handler: async (ctx, { orgId }): Promise<null> => {
    await seatOf(ctx, ctx.userId, orgId);
    await setActiveOrgOf(ctx, ctx.userId, orgId);
    return null;
  },
});
