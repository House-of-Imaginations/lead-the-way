# Data model and privacy rules (Convex)

This is the starting point for `convex/schema.ts`, not a finished design. The brainstorming step may rename or merge tables, but the **privacy rules at the bottom are fixed requirements**.

## Principles

1. **Journey state lives in Convex.** Anything a screen shows that another persona can change (agreement, invitations, projects, week, outcomes) is a Convex document, not React state. Switching from Priya to Dan must show Priya's saved agreement straight away.
2. **Privacy is enforced in Convex functions, not in components.** A manager-facing query must be unable to return an individual's learning progress, time or survey answer, even if a component asks for it.
3. **One identity seam.** Every function resolves the current person through `getViewer(ctx)` in `convex/lib/viewer.ts`, which maps the signed-in auth user to a `people` row. Nothing else reads auth directly, so the provider can change without touching features.
4. **Real sign-up and log-in, seeded demo accounts.** The `/signup` and `/login` screens are real (recommended: Convex Auth with the Password provider, so accounts live in the same deployment). Seed Priya, Dan and the seven teammates as accounts with a shared demo password shown only on `/guide`. "Switch to Dan's view" signs out and signs in as the seeded account through a dev-only action, so persona switching still works for testing.
5. **Seeded, resettable demo.** `convex/seed.ts` creates Calder Lane exactly as the wireframes show. The guide page can reset it and move the demo clock between sprint weeks.

## Cast and values (seed data)

- Workspace **Calder Lane** (`calderlane.com.au`), partner **Southbank Business Collective** (fictional). Privacy threshold 5, "Hide team totals below 5 responses" on.
- Team **Client Services team**, 8 people, industry Professional services, function Client service.
- Manager **Priya Raman** (PR), Team manager. Employee **Dan Okafor** (DO), Senior Account Executive.
- Teammates: Sarah Whitlock, Mei Tanaka, Tomás Reyes, Aisha Karimi, Luca Bianchi, Grace Oyelaran, Omar Haddad. Emails `first.last@calderlane.com.au` (Tomás is `tomas.reyes@`).
- Sprint 9 to 30 September 2026, **Wednesdays 2:00 to 3:00 PM**, 4 weeks, course **AI Productivity Fundamentals** (existing SkillsBuild course, 4 sessions of 15 min). Setup 1 to 8 Sep. Agreement saved 7 September 2026. Show and tell 30 September.
- Manager pathway **Leading AI at Work**: 3 modules, 5 + 10 + 10 min ("Why your team needs shared AI norms", "Supporting AI learning without micromanaging", "Creating your Team AI Agreement"). Priya at 65% on the dashboard state.
- Agreement: tools Microsoft Copilot, ChatGPT Enterprise; never goes in: client names, personal information, passwords, confidential commercial information, unapproved customer data; checks: verify factual claims, check sources or citations, human review before client delivery, review tone and context, check calculations, check for bias or inappropriate assumptions; escalation text from the brief; contact Priya Raman.
- Dashboard state (week 2): 8 invited, 7 joined, 6 of 7 finished week 1, 5 of 7 real tasks underway. Dan's course at 60%.
- Dan's project: "AI-assisted weekly client reporting". Before about 2 hours; after about 1 hour 20 minutes; **40 minutes saved per week**; both safety checks ticked; learned: "AI helped speed up the first draft, but I still needed to verify the client metrics manually."
- Badge **AI Fundamentals**, completed 24 September 2026, skills: AI prompting, Critical evaluation, Responsible AI, Workflow improvement.
- Outcomes (week 4 state): 8 invited, 7 completed, 6 applied projects presented. Confidence using AI at work 2.6 to 4.0; comfort discussing AI with my manager 2.6 to 3.9; 7 responses each. (The original brief said 2.8 for the first "before"; the wireframes use 2.6. Use 2.6.)

All figures are mock data and must be labelled as examples anywhere outside the app (guide, landing).

## Draft schema

```ts
// convex/schema.ts (draft)
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server"; // if Convex Auth is chosen
import { v } from "convex/values";

const role = v.union(v.literal("manager"), v.literal("employee"));
const phase = v.union(v.literal("before"), v.literal("after"));

export default defineSchema({
  ...authTables,                           // users, sessions, accounts... managed by Convex Auth

  workspaces: defineTable({
    name: v.string(),
    domain: v.string(),
    partnerName: v.string(),
    privacyThreshold: v.number(),          // 5
    hideSmallTotals: v.boolean(),          // true
    demoNow: v.optional(v.number()),       // demo clock (ms); undefined = real time
  }),

  people: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.optional(v.id("users")),    // the auth user; unset until the person signs up or accepts an invite
    name: v.string(),
    initials: v.string(),
    email: v.string(),
    jobTitle: v.string(),
  }).index("by_workspace", ["workspaceId"]).index("by_email", ["email"]).index("by_user", ["userId"]),

  teams: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    sizeBand: v.string(),                  // "6 to 10"
    industry: v.string(),
    teamFunction: v.string(),
    aiConfidence: v.string(),
    challenges: v.array(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  memberships: defineTable({
    teamId: v.id("teams"),
    personId: v.id("people"),
    role,
  }).index("by_team", ["teamId"]).index("by_person", ["personId"]),

  sprints: defineTable({
    teamId: v.id("teams"),
    status: v.union(v.literal("draft"), v.literal("scheduled"), v.literal("active"), v.literal("complete")),
    startDate: v.string(),                 // "2026-09-09"
    weeks: v.number(),                     // 4
    protectedHour: v.object({ weekday: v.number(), start: v.string(), durationMinutes: v.number() }),
    commitment: v.optional(v.object({ acceptedAt: v.number() })),
    notReady: v.optional(v.object({ at: v.number(), reason: v.optional(v.string()) })),
    courseId: v.id("courses"),
    inviteMessage: v.optional(v.string()),
    launchedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_team", ["teamId"]),

  invitations: defineTable({
    sprintId: v.id("sprints"),
    email: v.string(),
    token: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
    personId: v.optional(v.id("people")),
    sentAt: v.number(),
    respondedAt: v.optional(v.number()),
  }).index("by_sprint", ["sprintId"]).index("by_token", ["token"]),

  pathwayModules: defineTable({ order: v.number(), title: v.string(), minutes: v.number(), objective: v.string() }),
  pathwayProgress: defineTable({ personId: v.id("people"), moduleId: v.id("pathwayModules"), completedAt: v.number() })
    .index("by_person", ["personId"]),

  agreements: defineTable({
    teamId: v.id("teams"),
    version: v.number(),
    tools: v.array(v.string()),
    neverIn: v.array(v.object({ label: v.string(), on: v.boolean() })),
    checks: v.array(v.object({ label: v.string(), on: v.boolean() })),
    escalation: v.string(),
    contactPersonId: v.id("people"),
    savedAt: v.optional(v.number()),
    savedBy: v.optional(v.id("people")),
  }).index("by_team", ["teamId"]),
  agreementSignatures: defineTable({ agreementId: v.id("agreements"), version: v.number(), personId: v.id("people"), signedAt: v.number() })
    .index("by_agreement", ["agreementId"]).index("by_person", ["personId"]),

  courses: defineTable({ title: v.string(), provider: v.string(), sessions: v.number(), minutesPerSession: v.number() }),

  // PRIVATE to the learner. Never returned to anyone else, only counted.
  learningProgress: defineTable({
    personId: v.id("people"), sprintId: v.id("sprints"), courseId: v.id("courses"),
    percent: v.number(), sessionsDone: v.number(), updatedAt: v.number(),
  }).index("by_sprint", ["sprintId"]).index("by_person_sprint", ["personId", "sprintId"]),

  projects: defineTable({
    personId: v.id("people"), sprintId: v.id("sprints"), week: v.number(),
    title: v.string(), before: v.string(), change: v.string(), after: v.string(),
    resultTypes: v.array(v.string()), headline: v.optional(v.string()),
    humanReviewed: v.boolean(), dataSafe: v.boolean(),
    screenshotId: v.optional(v.id("_storage")),
    status: v.union(v.literal("draft"), v.literal("saved")),
    sharing: v.union(v.literal("private"), v.literal("team")),   // "team" only after the person chooses to present
    learned: v.optional(v.string()),
    presentedAt: v.optional(v.number()),
  }).index("by_sprint", ["sprintId"]).index("by_person", ["personId"]),

  badges: defineTable({
    personId: v.id("people"), name: v.string(), issuer: v.string(), completedAt: v.string(),
    reflectionProjectId: v.optional(v.id("projects")), shareSlug: v.string(),
  }).index("by_person", ["personId"]).index("by_slug", ["shareSlug"]),

  // Survey answers are stored per person only to prevent double answers. Never returned, only aggregated.
  surveyResponses: defineTable({
    sprintId: v.id("sprints"), personId: v.id("people"), phase,
    question: v.union(v.literal("aiConfidence"), v.literal("comfortWithManager"), v.literal("normsConfidence")),
    score: v.number(),                     // 1 to 5
  }).index("by_sprint_question", ["sprintId", "question", "phase"]).index("by_person", ["personId"]),

  settings: defineTable({
    personId: v.id("people"),
    weeklyReminder: v.boolean(),
    shareProjectsByDefault: v.boolean(),
    includeInTeamTotals: v.boolean(),      // opt-out of counts entirely
  }).index("by_person", ["personId"]),

  // Behavioural evidence for the four assumptions (A1 to A4). Evaluator-only, no names in any view.
  events: defineTable({
    sprintId: v.optional(v.id("sprints")), type: v.string(), at: v.number(),
    meta: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
  }).index("by_type", ["type"]),
});
```

## Function map (by screen)

| Screen | Queries | Mutations |
|---|---|---|
| Sign up `/signup` | none | Convex Auth `signIn("password", { flow: "signUp" })`, then `people.createForViewer` (creates the workspace and team for a new manager, or links an invited person by email) |
| Log in `/login` | `viewer.home` (where to land by role and setup progress) | Convex Auth `signIn("password")`; `auth.requestPasswordReset` (simulated, always the same message) |
| Setup 1 `/setup/team` | `teams.current` | `teams.saveProfile`, `surveys.submit` (normsConfidence before) |
| Setup 2 `/setup/protected-hour` | `sprints.current` | `sprints.setProtectedHour`, `sprints.commit`, `sprints.notReady` (logs A1 event with reason) |
| Pathway `/manager/learning` | `pathway.forViewer` | `pathway.completeModule`, `surveys.submit` (normsConfidence after) |
| Agreement `/manager/agreement` | `agreements.current` | `agreements.save` (bumps version), `agreements.addTool` |
| Launch `/manager/sprint/launch` | `sprints.current`, `invitations.list` | `invitations.add`, `sprints.launch` (creates invitations, schedules weekly reminders) |
| Overview `/manager` | `manager.overview` (aggregates only) | none |
| Invitation `/join/[token]` | `invitations.byToken` | `invitations.accept` |
| Agreement `/me/agreement` | `agreements.current`, `agreements.mySignature` | `agreements.sign` |
| This week `/me` | `me.thisWeek` | `learning.continueSession` (simulated +1 session) |
| Work project `/me/project` | `projects.mine` | `projects.saveDraft`, `projects.save`, `files.generateUploadUrl` |
| My sprint `/me/sprint` | `me.sprint` | none |
| Show and tell `/me/show-and-tell` | `showAndTell.board` (only projects with sharing "team") | `projects.present`, `projects.setLearned` |
| Credential `/me/credential` | `badges.mine` | `badges.attachReflection` |
| Outcomes `/manager/outcomes` | `manager.outcomes` (aggregates only) | `sprints.complete`, `sprints.cloneForNext` |
| Settings | `settings.mine`, `workspace.settings` | `settings.update`, `workspace.updatePrivacy` |
| Guide `/guide` | `demo.state` | `demo.reset`, `demo.setWeek` (moves `demoNow`), `demo.signInAs` (dev-only persona switch) |

## Privacy rules (fixed requirements, each needs a test)

1. `manager.overview` and `manager.outcomes` return **counts and averages only**. Their return validators contain no `personId`, name, email or per-person number.
2. No function returns another person's `learningProgress`, time, survey score or draft project. A person can read their own.
3. Any aggregate built from fewer than `workspace.privacyThreshold` responses returns `{ hidden: true, n }` when `hideSmallTotals` is on. The UI shows "Hidden until 5 responses".
4. Projects reach the team or manager only when their owner sets `sharing: "team"` (presenting at show and tell). Draft projects are never visible to others.
5. People with `includeInTeamTotals: false` are excluded from every count and average.
6. Manager-only mutations (agreement, launch, workspace settings) check the viewer's membership role and throw otherwise. Employee pages called as a manager show the manager's own employee-style data, never someone else's.
7. The members table in workspace settings shows name, role and invitation state only.
8. Every public function rejects calls with no signed-in viewer, except the invitation lookup by token and the public credential page by slug.
9. Log-in and reset flows never reveal whether an email has an account.

Suggested tests (`convex/*.test.ts` with `convex-test` and Vitest): "overview has no per-person fields", "outcomes hide averages under threshold", "manager cannot read Dan's learning progress", "draft project invisible on show and tell", "opt-out person not counted", "employee cannot save the agreement", "signed-out calls are rejected", "reset request gives the same response for unknown emails".
