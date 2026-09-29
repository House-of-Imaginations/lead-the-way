import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The demo workspace's script: which teammate step is due when, and whether it
 * has run. What a step DOES is code (`convex/lib/demo/script.ts`), keyed by
 * `key`, so a row carries no payload and nothing here is untyped.
 */
export const demoTables = {
  demoScript: defineTable({
    orgId: v.id("orgs"),
    key: v.string(),
    at: v.number(),
    appliedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_and_at", ["orgId", "at"]),
};
