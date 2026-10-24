import { defineTable } from "convex/server";
import { v } from "convex/values";
import { CREDENTIALS, TARGETS } from "../lib/careers/catalog";

/** A map's hours a week: 1, 2 or 3 (`catalog.weeksForHours`). */
const hours = v.union(v.literal(1), v.literal(2), v.literal(3));
const targetRole = v.union(...TARGETS.map((t) => v.literal(t.id)));
const credentialId = v.union(...CREDENTIALS.map((c) => v.literal(c.id)));

/**
 * The Change careers track (D12, spec 5.1): keyed by `userId` or
 * `careerProfileId`, with no org, so nothing a workspace holds can reach it
 * and a workspace deletion never touches it. Target, credential and lesson
 * ids are the string ids of `lib/careers/catalog.ts`. Every table is in
 * `CAREER_TABLES`.
 */
export const careerTables = {
  careerProfiles: defineTable({
    userId: v.string(),
    kind: v.union(v.literal("learner"), v.literal("guide")),
    firstName: v.string(),
    // A role name only (P1), removed by Delete my answers (P8).
    currentRole: v.optional(v.string()),
    targetRole: v.optional(targetRole),
    hoursPerWeek: v.optional(hours),
    consentAt: v.optional(v.number()),
    // Attribution and anonymous totals only (P4).
    partnerId: v.optional(v.id("careerPartners")),
    // ponytail: optional until claimDraft (P12a Task 3) sets them on every profile.
    timezone: v.optional(v.string()),
    a11y: v.optional(
      v.object({
        captions: v.boolean(),
        transcripts: v.boolean(),
        audioFirst: v.boolean(),
      }),
    ),
    guideBio: v.optional(v.string()),
    // How the track started (spec 11.4); `contactEmail` is required when private (X3).
    private: v.boolean(),
    contactEmail: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_partner", ["partnerId"]),

  /** One per learner profile: privacy (P2 to P5), reminders and Listen instead. */
  careerSettings: defineTable({
    careerProfileId: v.id("careerProfiles"),
    showDoneToCrew: v.boolean(),
    guideSeesProgress: v.boolean(),
    reflectionOnProof: v.boolean(),
    researchOptIn: v.boolean(),
    learningHour: v.boolean(),
    crewCheckIn: v.boolean(),
    missedWeekNudge: v.boolean(),
    sundaySummary: v.boolean(),
    listenInstead: v.boolean(),
  }).index("by_careerProfile", ["careerProfileId"]),

  /** Before an account exists (P9): no name, no email, gone after 30 days. */
  mapDrafts: defineTable({
    token: v.string(),
    partnerId: v.optional(v.id("careerPartners")),
    currentRole: v.string(),
    targetRole,
    hoursPerWeek: hours,
    consentAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_createdAt", ["createdAt"]),

  careerPartners: defineTable({
    slug: v.string(),
    name: v.string(),
    kind: v.string(),
  }).index("by_slug", ["slug"]),

  crews: defineTable({
    guideId: v.id("careerProfiles"),
    targetRole,
    credentialId,
    // 0 is Sunday, as `Date.getDay`.
    checkInDay: v.number(),
    checkInTime: v.string(),
    startsOn: v.string(),
    capacity: v.number(),
  }).index("by_guide", ["guideId"]),

  crewMembers: defineTable({
    crewId: v.id("crews"),
    careerProfileId: v.id("careerProfiles"),
    joinedAt: v.number(),
    // Set when they agree to the Crew Agreement, after joining.
    agreedAt: v.optional(v.number()),
  })
    .index("by_crew", ["crewId"])
    .index("by_careerProfile", ["careerProfileId"]),

  /** The Crew Agreement's rules. */
  crewRules: defineTable({
    crewId: v.id("crews"),
    text: v.string(),
    source: v.union(v.literal("guide"), v.literal("member")),
    proposedBy: v.optional(v.id("careerProfiles")),
    status: v.union(
      v.literal("active"),
      v.literal("suggested"),
      v.literal("proposed"),
      v.literal("declined"),
    ),
  }).index("by_crew", ["crewId"]),

  ruleChoices: defineTable({
    ruleId: v.id("crewRules"),
    careerProfileId: v.id("careerProfiles"),
    on: v.boolean(),
  })
    .index("by_careerProfile_and_rule", ["careerProfileId", "ruleId"])
    .index("by_rule", ["ruleId"]),

  /** P7: no title is stored; a calendar hold reads "Busy". */
  protectedHours: defineTable({
    careerProfileId: v.id("careerProfiles"),
    // 0 is Sunday, as `Date.getDay`.
    days: v.array(v.number()),
    startTime: v.string(),
    calendarHold: v.boolean(),
  }).index("by_careerProfile", ["careerProfileId"]),

  /** P6: completions only; no streak or missed-week field. */
  lessonProgress: defineTable({
    careerProfileId: v.id("careerProfiles"),
    lessonId: v.string(),
    completedAt: v.number(),
  }).index("by_careerProfile", ["careerProfileId"]),

  careerProjects: defineTable({
    careerProfileId: v.id("careerProfiles"),
    credentialId,
    task: v.string(),
    whatIDid: v.string(),
    reflection: v.string(),
    skills: v.array(v.string()),
    addReflectionToProof: v.boolean(),
    reviewedBy: v.optional(v.id("careerProfiles")),
    reviewedAt: v.optional(v.number()),
  }).index("by_careerProfile", ["careerProfileId"]),

  demoDays: defineTable({
    crewId: v.id("crews"),
    at: v.number(),
  }).index("by_crew", ["crewId"]),

  presentations: defineTable({
    demoDayId: v.id("demoDays"),
    projectId: v.id("careerProjects"),
    careerProfileId: v.id("careerProfiles"),
    presentedAt: v.optional(v.number()),
  })
    .index("by_demoDay", ["demoDayId"])
    .index("by_careerProfile", ["careerProfileId"]),

  /** Keyed by `userId`, so a badge outlives a deleted track (P8, X6). */
  careerBadges: defineTable({
    userId: v.string(),
    credentialId,
    earnedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Keyed by the learner's `userId`, kept with their badges (P8, X6). */
  endorsements: defineTable({
    userId: v.string(),
    guideId: v.id("careerProfiles"),
    credentialId,
    text: v.string(),
  }).index("by_user", ["userId"]),

  proofLinks: defineTable({
    careerProfileId: v.id("careerProfiles"),
    slug: v.string(),
    credentialId,
  })
    .index("by_slug", ["slug"])
    .index("by_careerProfile", ["careerProfileId"]),

  /** Private to the learner (P3, P5). */
  confidence: defineTable({
    careerProfileId: v.id("careerProfiles"),
    credentialId,
    value: v.number(),
    at: v.number(),
  }).index("by_careerProfile", ["careerProfileId"]),

  /** The careers clock, one row (spec 7). */
  careerDemo: defineTable({
    now: v.optional(v.number()),
    missedWeek: v.boolean(),
  }),

  /** Counts only: never a person id (P10). */
  careerEvents: defineTable({
    name: v.string(),
    at: v.number(),
    partnerId: v.optional(v.id("careerPartners")),
  }),
};
