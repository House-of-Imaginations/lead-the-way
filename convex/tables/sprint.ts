import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { aggregateValidator } from "../lib/privacy";

/**
 * The product: one team per workspace, its sprint, and what people do in it.
 *
 * EVERY TABLE CARRIES `orgId` AND A `by_org` INDEX. That is what lets
 * `deleteOrg` and the demo reset clear a workspace with one loop (`ORG_TABLES`
 * in `convex/lib/orgs/cascade.ts`), and it keeps every read scoped to one
 * tenant. `tests/convex/schema.test.ts` fails when a table skips the list.
 *
 * Privacy is not a property of these tables: they hold each person's own rows.
 * What a manager may see of them is decided in `convex/lib/privacy.ts`.
 */

const personId = v.id("people");

export const EVENT_TYPES = [
  "hour.committed",
  "hour.notReady",
  "pathway.completed",
  "agreement.saved",
  "sprint.launched",
  "invite.accepted",
  "agreement.signed",
  "project.saved",
  "project.presented",
  "survey.answered",
] as const;
export const eventTypeValidator = literals(...EVENT_TYPES);
export type EventType = (typeof EVENT_TYPES)[number];

export const SURVEY_QUESTIONS = [
  "aiConfidence",
  "comfortWithManager",
  "normsConfidence",
] as const;
export const surveyQuestionValidator = literals(...SURVEY_QUESTIONS);
export type SurveyQuestion = (typeof SURVEY_QUESTIONS)[number];
export const phaseValidator = literals("before", "after");

export const PROJECT_CATEGORIES = [
  "Reporting and drafting",
  "Email workflows",
  "Meeting notes",
  "Analysis",
] as const;
export const projectCategoryValidator = literals(...PROJECT_CATEGORIES);
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const toggleValidator = v.object({ label: v.string(), on: v.boolean() });
/** Who to ask: a member, or one of `CONTACT_LABELS` (`lib/agreement.ts`). */
export const contactValidator = v.union(
  v.object({ kind: v.literal("person"), personId }),
  v.object({ kind: v.literal("label"), label: v.string() }),
);

export const sprintTables = {
  /** One per workspace. `sizeBand` is stored as shown: "6 to 10". */
  teams: defineTable({
    orgId: v.id("orgs"),
    name: v.string(),
    sizeBand: v.optional(v.string()),
    industry: v.optional(v.string()),
    teamFunction: v.optional(v.string()),
    aiUse: v.optional(v.string()),
    challenges: v.array(v.string()),
    challengeOther: v.optional(v.string()),
    savedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  /**
   * The four-week sprint. `startDate` is a Melbourne calendar date
   * ("2026-09-09"), not an instant, because "Wednesday 2:00 PM" means the same
   * wall-clock hour every week. `weekday` follows `Date#getDay` (3 is
   * Wednesday). `status` is no longer written or read (P5 Ruling 11): the
   * phase comes from `sprintPhase`. It stays optional so older rows validate.
   */
  sprints: defineTable({
    orgId: v.id("orgs"),
    teamId: v.id("teams"),
    status: v.optional(literals("draft", "scheduled", "active", "complete")),
    startDate: v.string(),
    timeZone: v.string(),
    weeks: v.number(),
    protectedHour: v.object({
      weekday: v.number(),
      start: v.string(),
      durationMinutes: v.number(),
    }),
    committedAt: v.optional(v.number()),
    notReady: v.optional(
      v.object({
        at: v.number(),
        reason: v.string(),
        detail: v.optional(v.string()),
      }),
    ),
    courseTitle: v.string(),
    inviteMessage: v.optional(v.string()),
    launchedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  /** The manager's own pathway. `moduleKey` is a `PATHWAY_MODULES` key. */
  pathwayProgress: defineTable({
    orgId: v.id("orgs"),
    personId,
    moduleKey: v.string(),
    minutesWatched: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_person_and_module", ["personId", "moduleKey"]),

  /** The Team AI Agreement. A new version is a new row; signatures name it. */
  agreements: defineTable({
    orgId: v.id("orgs"),
    teamId: v.id("teams"),
    version: v.number(),
    status: literals("draft", "saved"),
    tools: v.array(v.string()),
    neverIn: v.array(toggleValidator),
    checks: v.array(toggleValidator),
    escalation: v.string(),
    contact: contactValidator,
    savedAt: v.optional(v.number()),
    savedBy: v.optional(personId),
  })
    .index("by_org", ["orgId"])
    .index("by_team_and_version", ["teamId", "version"]),

  agreementSignatures: defineTable({
    orgId: v.id("orgs"),
    agreementId: v.id("agreements"),
    version: v.number(),
    personId,
    signedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_agreement_version_and_person", [
      "agreementId",
      "version",
      "personId",
    ]),

  /** A person's own course progress. Never readable by a manager (rule 4). */
  learningProgress: defineTable({
    orgId: v.id("orgs"),
    personId,
    sprintId: v.id("sprints"),
    sessionsDone: v.number(),
    percent: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_person_and_sprint", ["personId", "sprintId"]),

  /** The real-work project. A draft is private to its owner, whatever `sharing` says. */
  projects: defineTable({
    orgId: v.id("orgs"),
    personId,
    sprintId: v.id("sprints"),
    startedWeek: v.number(),
    category: v.optional(projectCategoryValidator),
    title: v.string(),
    before: v.string(),
    change: v.string(),
    after: v.string(),
    resultTypes: v.array(v.string()),
    headline: v.optional(v.string()),
    humanReviewed: v.boolean(),
    dataSafe: v.boolean(),
    screenshotId: v.optional(v.id("_storage")),
    status: literals("draft", "saved"),
    sharing: literals("private", "team"),
    learned: v.optional(v.string()),
    howChecked: v.optional(v.string()),
    presentedAt: v.optional(v.number()),
    autosavedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_sprint_and_presentedAt", ["sprintId", "presentedAt"])
    .index("by_screenshotId", ["screenshotId"])
    .index("by_person_and_sprint", ["personId", "sprintId"]),

  /** A credential. `shareSlug` is the public link, the only signed-out read. */
  badges: defineTable({
    orgId: v.id("orgs"),
    personId,
    name: v.string(),
    issuer: v.string(),
    completedAt: v.number(),
    skills: v.array(v.string()),
    reflectionProjectId: v.optional(v.id("projects")),
    shareSlug: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_person", ["personId"])
    .index("by_shareSlug", ["shareSlug"]),

  /**
   * One row per answer. Only ever read back as an aggregate by a manager.
   * A row has exactly one of `score` (an answer) and `skippedAt` ("Skip for
   * now", Ruling 6). A skip is not an answer: every reader treats a row
   * without a score as nobody answering.
   */
  surveyResponses: defineTable({
    orgId: v.id("orgs"),
    sprintId: v.id("sprints"),
    personId,
    phase: phaseValidator,
    question: surveyQuestionValidator,
    score: v.optional(v.number()),
    skippedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_person_and_sprint", ["personId", "sprintId"])
    .index("by_sprint_phase_and_question", ["sprintId", "phase", "question"]),

  /** No row means the defaults; `includeInTeamTotals` defaults to true. */
  settings: defineTable({
    orgId: v.id("orgs"),
    personId,
    weeklyReminder: v.boolean(),
    showAndTellReminder: v.boolean(),
    askBeforeSharing: v.boolean(),
    reflectionsOnCredential: v.boolean(),
    includeInTeamTotals: v.boolean(),
    captionsByDefault: v.boolean(),
    reduceMotion: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_person", ["personId"]),

  /** What happened when, for the timeline and outcomes. No person id on purpose. */
  events: defineTable({
    orgId: v.id("orgs"),
    sprintId: v.optional(v.id("sprints")),
    type: eventTypeValidator,
    at: v.number(),
    meta: v.optional(
      v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
    ),
  })
    .index("by_org", ["orgId"])
    .index("by_sprint_and_type", ["sprintId", "type"]),

  /**
   * Team totals, frozen when each week's hour ends (Rulings 1 and 2). One row
   * per (sprint, week), never rewritten. Aggregates only: no person id.
   */
  teamSnapshots: defineTable({
    orgId: v.id("orgs"),
    sprintId: v.id("sprints"),
    week: v.number(),
    takenAt: v.number(),
    sessionDone: aggregateValidator,
    tasksUnderway: aggregateValidator,
  })
    .index("by_org", ["orgId"])
    .index("by_sprint_and_week", ["sprintId", "week"]),
};
