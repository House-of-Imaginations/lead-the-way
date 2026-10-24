import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The Change careers track (D12): keyed by `userId`, with no org, so nothing a
 * workspace holds can reach it and a workspace deletion never touches it.
 * P12a adds the remaining fields from spec 5.1.
 */
export const careerTables = {
  careerProfiles: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("learner"), v.literal("guide")),
    firstName: v.string(),
    private: v.boolean(),
    contactEmail: v.optional(v.string()),
  }).index("by_user", ["userId"]),
};
