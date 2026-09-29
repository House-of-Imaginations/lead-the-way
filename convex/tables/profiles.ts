import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The account-level record: a display name and the workspace the app opens.
 * Auth owns identity; everything a workspace says about a person is on their
 * `people` row. No soft delete and no avatar (spec 5).
 */
export const profileTables = {
  profiles: defineTable({
    userId: v.string(),
    displayName: v.string(),
    // The workspace the app opens. `getViewer` falls back when it is stale.
    activeOrgId: v.optional(v.id("orgs")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
};
