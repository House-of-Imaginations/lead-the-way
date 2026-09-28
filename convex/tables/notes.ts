import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The example table. Delete it, or rename it into the first real feature.
 *
 * It exists to show the two things every table in this app is expected to do:
 * carry the owner's id as a plain string (the Better Auth subject, never an
 * `Id<"users">` -- auth owns that row, not us), and index every field a query
 * filters on. A `.filter()` on a query is a table scan wearing a predicate.
 */
export const noteTables = {
  notes: defineTable({
    userId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
};
