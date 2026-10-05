import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { EventType, ProjectCategory } from "../../tables/sprint";
import { latestAgreement, latestSaved } from "../agreement";
import { throwUserError } from "../errors";
import { logEvent } from "../events";
import { insertInvite, inviteRoleOf } from "../orgs/invites";
import { joinByInvite } from "../orgs/join";
import { MAX_MEMBERS_PER_ORG } from "../orgs/membership";
import { badgeOf, issueBadge } from "../badges";
import { projectOf } from "../projects";
import { settingsOf } from "../settings";
import { PATHWAY_MODULES, type ModuleKey } from "../pathway";
import { setupSprint, currentTeam } from "../sprint";
import { upsertAnswer } from "../surveys";
import { DEMO_CAST, castOf, demoUserId, type CastKey } from "./cast";
import type { StepKey } from "./schedule";

/**
 * What each scripted step does to the demo workspace.
 *
 * THREE RULES, in every step:
 *  1. The state wins: read first, and skip what the tester already did.
 *  2. Fill blanks only: never overwrite a value somebody chose.
 *  3. Never lower a value: progress and minutes only go up.
 *
 * `setClock` runs these for the demo workspace only, and each step writes
 * only rows with that `orgId`.
 *
 * THE CONTRACT WITH THE PRODUCT'S WRITERS. The script and the product write
 * the same rows, so each reads what the other wrote. Every later writer (P3
 * onwards) keeps these twelve rules, or the script and the screens disagree:
 *  1. One `teams` row per org, and one current sprint.
 *  2. The team is done when `teams.savedAt` is set.
 *  3. The hour is decided when `sprints.committedAt` or `sprints.notReady`
 *     is set.
 *  4. The sprint is launched when `sprints.launchedAt` is set.
 *  5. One row per (person, module) in `pathwayProgress`, per (person, sprint)
 *     in `learningProgress` and `projects`, per (agreement, version, person)
 *     in `agreementSignatures`, per (person, sprint, phase, question) in
 *     `surveyResponses`, per person in `settings`, and per (sprint, week,
 *     person) in `reminders`. Writers upsert; they never add a second row.
 *  6. `orgInvites.email` and `people.email` are lowercased.
 *  7. An agreement counts as saved at `status: "saved"`, and versions only
 *     go up.
 *  8. Both paths log every event type with the same meta keys, at
 *     `now = nowFor(org)`.
 *  9. A project starts as a private draft. Presenting sets `sharing: "team"`
 *     and `presentedAt` together; a project is presented exactly when
 *     `isPresented` holds (Ruling 4).
 * 10. `issueBadge` is the one writer of `badges` (Ruling 9).
 * 11. A `surveyResponses` row holds exactly one of `score` and `skippedAt`,
 *     and an answer replaces a skip (Ruling 6).
 * 12. A person's settings are read through `settingsOf` before acting for
 *     them (Ruling 5).
 */

type StepCtx = { ctx: MutationCtx; orgId: Id<"orgs">; at: number };
type Step = (step: StepCtx) => Promise<void>;
type Scores = [aiConfidence: number, comfortWithManager: number];
type ProjectKey = "dan" | "mei" | "sarah" | "tomas" | "aisha" | "luca";

const JOINED: CastKey[] = [
  "dan",
  "sarah",
  "mei",
  "tomas",
  "aisha",
  "luca",
  "grace",
];

const TEAM = {
  sizeBand: "6 to 10",
  industry: "Professional services",
  teamFunction: "Client service",
  // The option wireframe 03 selects.
  aiUse: "Advanced users, inconsistent practices",
  challenges: ["Staff are using AI differently", "Lack of time to learn"],
};

// ponytail: the demo holds a handful of invitations (8 by script). Past 500 a
// step could miss one and invite a cast member twice; page it if that matters.
const DEMO_INVITES_READ = 500;

export const INVITE_MESSAGE =
  "Hi team, from Wednesday 9 September we'll protect 2:00 to 3:00 PM every week for practical AI learning. Bring one real task you'd like to make easier. Priya";

/** Agreement v1, worded as `docs/design/data-model.md` and screen 06 have it. */
function agreementV1(contact: Id<"people">) {
  const toggles = (labels: string[], onCount: number) =>
    labels.map((label, i) => ({ label, on: i < onCount }));
  return {
    tools: ["Microsoft Copilot", "ChatGPT Enterprise"],
    neverIn: toggles(
      [
        "Client names",
        "Personal information",
        "Passwords",
        "Confidential commercial information",
        "Unapproved customer data",
      ],
      5,
    ),
    checks: toggles(
      [
        "Verify factual claims",
        "Check sources or citations",
        "Human review before client delivery",
        "Review tone and context",
        "Check calculations",
        "Check for bias or inappropriate assumptions",
      ],
      4,
    ),
    escalation:
      "Escalate uncertainty when AI output may affect a client decision, sensitive data may be involved, or an approved-tool boundary is unclear.",
    contact: { kind: "person" as const, personId: contact },
  };
}

const BEFORE: Partial<Record<CastKey, Scores>> = {
  // Five answer before (spec 3.3): sums 14 and 13, so 2.8 and 2.6.
  dan: [3, 2],
  sarah: [3, 3],
  mei: [3, 3],
  tomas: [2, 3],
  aisha: [3, 2],
};
const AFTER: Partial<Record<CastKey, Scores>> = {
  // Seven answer after: sums 28 and 27, so 4.0 and 3.9.
  dan: [4, 4],
  sarah: [4, 4],
  mei: [4, 4],
  tomas: [4, 4],
  aisha: [4, 4],
  luca: [4, 4],
  grace: [4, 3],
};

type Canon = {
  category: ProjectCategory;
  title: string;
  before: string;
  change: string;
  after: string;
  resultTypes: string[];
  headline: string;
};

const PROJECTS: Record<ProjectKey, Canon> = {
  dan: {
    category: "Reporting and drafting",
    title: "AI-assisted weekly client reporting",
    before:
      "Weekly client reports took about 2 hours to pull together from account notes.",
    change:
      "Copilot drafts the summary from the notes; I check every figure against the source.",
    after:
      "Reports take about 1 hour 20 minutes, with the same checks as before.",
    resultTypes: ["Time saved"],
    headline: "40 minutes saved per week",
  },
  mei: {
    category: "Meeting notes",
    title: "Meeting notes to action lists",
    before:
      "Actions from client meetings were written up by hand, often the next day.",
    change:
      "Copilot turns my notes into an action list, which I check before sending.",
    after: "Action lists go out the same afternoon.",
    resultTypes: ["Time saved"],
    headline: "Action lists sent the same day",
  },
  sarah: {
    category: "Email workflows",
    title: "First drafts of client follow-up emails",
    before: "Follow-up emails after calls took a long time to start.",
    change:
      "Copilot writes a first draft from my call notes; I rewrite it in my voice.",
    after: "Follow-ups go out sooner and read more consistently.",
    resultTypes: ["Time saved", "Quality improvement"],
    headline: "Follow-ups sent within the hour",
  },
  tomas: {
    category: "Analysis",
    title: "Summarising account research",
    before:
      "Reading back through an account's history before a meeting took most of a morning.",
    change:
      "Copilot summarises the account file; I check the summary against the key documents.",
    after: "Meeting prep takes about an hour.",
    resultTypes: ["Time saved"],
    headline: "Meeting prep down to an hour",
  },
  aisha: {
    category: "Reporting and drafting",
    title: "Proposal section drafts",
    before:
      "Standard proposal sections were rewritten from scratch for each client.",
    change:
      "Copilot drafts the standard sections from our approved wording; I tailor and check them.",
    after: "Proposals start from a checked draft instead of a blank page.",
    resultTypes: ["Time saved", "Quality improvement"],
    headline: "Proposals start from a checked draft",
  },
  luca: {
    category: "Analysis",
    title: "Checking spreadsheet formulas",
    before:
      "Errors in shared spreadsheets were found late, sometimes by clients.",
    change:
      "Copilot explains each formula so I can check it does what the sheet says.",
    after: "Formula errors are caught before a sheet is shared.",
    resultTypes: ["Quality improvement"],
    headline: "Errors caught before sharing",
  },
};
const PRESENT_ORDER: ProjectKey[] = [
  "dan",
  "mei",
  "sarah",
  "tomas",
  "aisha",
  "luca",
];

const DAN_LEARNED =
  "AI helped speed up the first draft, but I still needed to verify the client metrics manually.";
const DAN_HOW_CHECKED =
  "I compared every figure in the draft with the account system before sending.";

// ---- reads ----

async function teamOf(ctx: MutationCtx, orgId: Id<"orgs">) {
  const team = await currentTeam(ctx, orgId);
  if (!team) {
    throwUserError(
      "DEMO_BROKEN",
      "The demo workspace has no team. Reset the demo.",
    );
  }
  return team;
}

async function sprintOf(ctx: MutationCtx, orgId: Id<"orgs">) {
  const sprint = await setupSprint(ctx, orgId);
  if (!sprint) {
    throwUserError(
      "DEMO_BROKEN",
      "The demo workspace has no sprint. Reset the demo.",
    );
  }
  return sprint;
}

/** A cast member's seat, found by address. Null when they haven't joined. */
async function personOf(ctx: MutationCtx, orgId: Id<"orgs">, key: CastKey) {
  const email = castOf(key).email;
  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(MAX_MEMBERS_PER_ORG);
  return people.find((p) => p.email === email) ?? null;
}

async function log(
  { ctx, orgId, at }: StepCtx,
  type: EventType,
  meta?: Record<string, string | number | boolean>,
) {
  const sprint = await sprintOf(ctx, orgId);
  await logEvent(ctx, { orgId, sprintId: sprint._id, type, at, meta });
}

// ---- writes, each keeping the three rules ----

async function answer(
  step: StepCtx,
  person: Doc<"people">,
  phase: "before" | "after",
  question: "aiConfidence" | "comfortWithManager" | "normsConfidence",
  score: number,
): Promise<boolean> {
  const { ctx, orgId, at } = step;
  const sprint = await sprintOf(ctx, orgId);
  const mine = await ctx.db
    .query("surveyResponses")
    .withIndex("by_person_and_sprint", (q) =>
      q.eq("personId", person._id).eq("sprintId", sprint._id),
    )
    .collect();
  // Rule 2: an answer somebody gave stands; `upsertAnswer` would replace it.
  if (mine.some((r) => r.phase === phase && r.question === question)) {
    return false;
  }
  await upsertAnswer(ctx, {
    orgId,
    sprintId: sprint._id,
    personId: person._id,
    phase,
    question,
    score,
    at,
  });
  return true;
}

async function checkIn(
  step: StepCtx,
  phase: "before" | "after",
  keys: CastKey[],
) {
  const scores = phase === "before" ? BEFORE : AFTER;
  const sprint = await sprintOf(step.ctx, step.orgId);
  for (const key of keys) {
    const person = await personOf(step.ctx, step.orgId, key);
    const score = scores[key];
    if (!person || !score) continue;
    // Rule 1: any row for this phase is the tester's, a skip included (Ruling 6).
    const mine = await step.ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", person._id).eq("sprintId", sprint._id),
      )
      .take(6);
    if (mine.some((r) => r.phase === phase)) continue;
    const a = await answer(step, person, phase, "aiConfidence", score[0]);
    const b = await answer(step, person, phase, "comfortWithManager", score[1]);
    if (a || b) await log(step, "survey.answered", { phase });
  }
}

async function progress(
  step: StepCtx,
  key: CastKey,
  sessionsDone: number,
  percent: number,
) {
  const { ctx, orgId, at } = step;
  const person = await personOf(ctx, orgId, key);
  if (!person) return;
  const sprint = await sprintOf(ctx, orgId);
  const row = await ctx.db
    .query("learningProgress")
    .withIndex("by_person_and_sprint", (q) =>
      q.eq("personId", person._id).eq("sprintId", sprint._id),
    )
    .unique();
  if (!row) {
    await ctx.db.insert("learningProgress", {
      orgId,
      personId: person._id,
      sprintId: sprint._id,
      sessionsDone,
      percent,
      updatedAt: at,
    });
    return;
  }
  if (row.sessionsDone >= sessionsDone && row.percent >= percent) return;
  await ctx.db.patch(row._id, {
    sessionsDone: Math.max(row.sessionsDone, sessionsDone),
    percent: Math.max(row.percent, percent),
    updatedAt: at,
  });
}

/** Everyone in `keys` attended week `week`'s session. */
async function session(step: StepCtx, week: number, keys: CastKey[]) {
  for (const key of keys) await progress(step, key, week, week * 25);
}

/** Priya watches `minutes` of a pathway module. True when that completed it. */
async function watch(
  step: StepCtx,
  moduleKey: ModuleKey,
  minutes: number,
): Promise<boolean> {
  const { ctx, orgId, at } = step;
  const priya = await personOf(ctx, orgId, "priya");
  if (!priya) return false;
  const total = PATHWAY_MODULES.find((m) => m.key === moduleKey)?.minutes ?? 0;
  const row = await ctx.db
    .query("pathwayProgress")
    .withIndex("by_person_and_module", (q) =>
      q.eq("personId", priya._id).eq("moduleKey", moduleKey),
    )
    .unique();
  const watched = Math.max(row?.minutesWatched ?? 0, minutes);
  const newlyDone = watched >= total && row?.completedAt === undefined;
  if (!row) {
    await ctx.db.insert("pathwayProgress", {
      orgId,
      personId: priya._id,
      moduleKey,
      minutesWatched: watched,
      completedAt: newlyDone ? at : undefined,
    });
  } else if (watched > row.minutesWatched || newlyDone) {
    await ctx.db.patch(row._id, {
      minutesWatched: watched,
      completedAt: row.completedAt ?? (newlyDone ? at : undefined),
    });
  }
  if (newlyDone) await log(step, "pathway.completed", { moduleKey });
  return newlyDone;
}

/** Everyone in `keys` signs the latest saved agreement. */
async function sign(step: StepCtx, keys: CastKey[]) {
  const { ctx, orgId, at } = step;
  const team = await teamOf(ctx, orgId);
  const saved = await latestSaved(ctx, team._id);
  if (!saved) return;
  for (const key of keys) {
    const person = await personOf(ctx, orgId, key);
    if (!person) continue;
    const signed = await ctx.db
      .query("agreementSignatures")
      .withIndex("by_agreement_version_and_person", (q) =>
        q
          .eq("agreementId", saved._id)
          .eq("version", saved.version)
          .eq("personId", person._id),
      )
      .unique();
    if (signed) continue;
    await ctx.db.insert("agreementSignatures", {
      orgId,
      agreementId: saved._id,
      version: saved.version,
      personId: person._id,
      signedAt: at,
    });
    await log(step, "agreement.signed", { version: saved.version });
  }
}

async function draft(step: StepCtx, key: ProjectKey, week: number) {
  const { ctx, orgId, at } = step;
  const person = await personOf(ctx, orgId, key);
  if (!person) return;
  const sprint = await sprintOf(ctx, orgId);
  if (await projectOf(ctx, person._id, sprint._id)) return;
  const canon = PROJECTS[key];
  await ctx.db.insert("projects", {
    orgId,
    personId: person._id,
    sprintId: sprint._id,
    startedWeek: week,
    category: canon.category,
    title: canon.title,
    before: canon.before,
    change: canon.change,
    after: "",
    resultTypes: [],
    humanReviewed: false,
    dataSafe: false,
    status: "draft",
    // Ruling 4: a draft is private; presenting is what shares.
    sharing: "private",
    autosavedAt: at,
  });
}

/** Exactly what `draft` wrote: nobody has typed, ticked or shared anything since. */
function untouched(project: Doc<"projects">, canon: Canon) {
  return (
    project.status === "draft" &&
    project.category === canon.category &&
    project.title === canon.title &&
    project.before === canon.before &&
    project.change === canon.change &&
    project.after === "" &&
    project.resultTypes.length === 0 &&
    project.headline === undefined &&
    !project.humanReviewed &&
    !project.dataSafe &&
    project.sharing === "private" &&
    project.screenshotId === undefined &&
    project.learned === undefined &&
    project.howChecked === undefined
  );
}

/**
 * Save a teammate's project as the script started it: fill its blanks and
 * tick both safety checks. Only a draft nobody has touched is saved. A project
 * the tester made or edited is theirs, so it stays as it is: the script never
 * ticks a safety check on somebody's behalf.
 */
async function save(step: StepCtx, key: ProjectKey) {
  const { ctx, orgId, at } = step;
  const person = await personOf(ctx, orgId, key);
  if (!person) return;
  const sprint = await sprintOf(ctx, orgId);
  await draft(step, key, 4);
  const project = await projectOf(ctx, person._id, sprint._id);
  const canon = PROJECTS[key];
  if (!project || !untouched(project, canon)) return;
  await ctx.db.patch(project._id, {
    after: canon.after,
    resultTypes: canon.resultTypes,
    headline: canon.headline,
    humanReviewed: true,
    dataSafe: true,
    status: "saved",
    autosavedAt: at,
  });
  // after, resultTypes and headline, as a product save counts them (spec 5).
  await log(step, "project.saved", { fieldsFilled: 3 });
}

// ---- the steps ----

export const STEPS: Record<StepKey, Step> = {
  "priya.team": async (step) => {
    const team = await teamOf(step.ctx, step.orgId);
    // Saved by the tester: their answers stand, blanks and a skipped rating
    // included (Ruling 4).
    if (team.savedAt !== undefined) return;
    await step.ctx.db.patch(team._id, {
      sizeBand: team.sizeBand ?? TEAM.sizeBand,
      industry: team.industry ?? TEAM.industry,
      teamFunction: team.teamFunction ?? TEAM.teamFunction,
      aiUse: team.aiUse ?? TEAM.aiUse,
      challenges: team.challenges.length ? team.challenges : TEAM.challenges,
      savedAt: step.at,
    });
    const priya = await personOf(step.ctx, step.orgId, "priya");
    if (priya) await answer(step, priya, "before", "normsConfidence", 2);
  },

  "priya.commit": async (step) => {
    const sprint = await sprintOf(step.ctx, step.orgId);
    // Committed, or "not ready" chosen: either way the tester has answered.
    if (sprint.committedAt !== undefined || sprint.notReady !== undefined) {
      return;
    }
    await step.ctx.db.patch(sprint._id, { committedAt: step.at });
    await log(step, "hour.committed");
  },

  "priya.pathway": async (step) => {
    let finished = false;
    for (const pathwayModule of PATHWAY_MODULES) {
      if (pathwayModule.pathway === "required") {
        const done = await watch(
          step,
          pathwayModule.key,
          pathwayModule.minutes,
        );
        finished = done || finished;
      }
    }
    // Only when the script finished the path. A tester who finished it and
    // skipped "Ready to launch?" keeps the skip (Ruling 4).
    if (!finished) return;
    const priya = await personOf(step.ctx, step.orgId, "priya");
    if (priya) await answer(step, priya, "after", "normsConfidence", 4);
  },

  "priya.agreement": async (step) => {
    const { ctx, orgId, at } = step;
    const team = await teamOf(ctx, orgId);
    // Any saved version means the tester saved one, even with a draft on top.
    if (await latestSaved(ctx, team._id)) return;
    const latest = await latestAgreement(ctx, team._id);
    const priya = await personOf(ctx, orgId, "priya");
    if (!priya) return;
    const canon = agreementV1(priya._id);
    if (latest) {
      await ctx.db.patch(latest._id, {
        tools: latest.tools.length ? latest.tools : canon.tools,
        neverIn: latest.neverIn.length ? latest.neverIn : canon.neverIn,
        checks: latest.checks.length ? latest.checks : canon.checks,
        escalation: latest.escalation || canon.escalation,
        status: "saved",
        savedAt: at,
        savedBy: priya._id,
      });
    } else {
      await ctx.db.insert("agreements", {
        orgId,
        teamId: team._id,
        version: 1,
        ...canon,
        status: "saved",
        savedAt: at,
        savedBy: priya._id,
      });
    }
    await log(step, "agreement.saved", { version: latest?.version ?? 1 });
  },

  // Always invites the full cast, even after the tester launched and chose
  // who to invite: the spec wants the team to arrive (spec 6).
  "priya.launch": async (step) => {
    const { ctx, orgId, at } = step;
    const sprint = await sprintOf(ctx, orgId);
    if (sprint.launchedAt === undefined) {
      await ctx.db.patch(sprint._id, {
        launchedAt: at,
        inviteMessage: sprint.inviteMessage ?? INVITE_MESSAGE,
      });
      await log(step, "sprint.launched");
    }
    const priya = await personOf(ctx, orgId, "priya");
    if (!priya) return;
    const role = await inviteRoleOf(ctx, orgId);
    const invited = new Set(
      (
        await ctx.db
          .query("orgInvites")
          .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
          .take(DEMO_INVITES_READ)
      ).map((invite) => invite.email),
    );
    for (const person of DEMO_CAST) {
      if (person.key === "priya" || invited.has(person.email)) continue;
      // `expiresAt` is real time, judged by the demo clock (`nowFor`), so it
      // outlives every demo target and Omar stays invited.
      await insertInvite(ctx, {
        orgId,
        roleId: role._id,
        email: person.email,
        name: person.name,
        sprintId: sprint._id,
        message: sprint.inviteMessage ?? INVITE_MESSAGE,
        invitedBy: priya.userId,
        at,
        sentAt: at,
      });
    }
  },

  "team.join": async (step) => {
    const { ctx, orgId, at } = step;
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) =>
        q.eq("orgId", orgId).eq("status", "pending"),
      )
      .take(DEMO_INVITES_READ);
    for (const key of JOINED) {
      if (await personOf(ctx, orgId, key)) continue;
      const cast = castOf(key);
      const invite = invites.find((i) => i.email === cast.email);
      // Revoked by the tester: they don't join.
      if (!invite) continue;
      const userId = await demoUserId(ctx, cast.email);
      if (!userId) {
        throwUserError(
          "DEMO_NOT_SEEDED",
          "The demo accounts are missing. Run seed:reset from the terminal first.",
        );
      }
      await joinByInvite(ctx, invite, userId, at, cast.jobTitle);
    }
  },

  "team.before": (step) =>
    checkIn(step, "before", ["sarah", "mei", "tomas", "aisha"]),

  "team.sign": (step) =>
    sign(step, ["priya", ...JOINED.filter((key) => key !== "dan")]),

  // Dan answers late, so a tester playing Dan can answer first. Luca and Grace
  // skip the before check-in: 5 before, 7 after (spec 3.3).
  "team.beforeLate": (step) => checkIn(step, "before", ["dan"]),

  // Dan signs late too, after the week 1 target, so a tester playing Dan can
  // sign first (spec 6: "Dan signs only if the tester hasn't").
  "team.signLate": (step) => sign(step, ["dan"]),

  "week1.session": async (step) => {
    await session(step, 1, ["dan", "sarah", "mei", "tomas", "aisha", "luca"]);
    for (const key of ["dan", "mei", "sarah", "tomas", "aisha"] as const) {
      await draft(step, key, 1);
    }
  },

  "priya.coaching": async (step) => {
    await watch(step, "coaching-conversations", 15);
    await watch(step, "coaching-first-task", 15);
    await watch(step, "coaching-feedback", 9);
  },

  "week2.progress": (step) => progress(step, "dan", 1, 60),

  "week2.session": (step) => session(step, 2, JOINED),

  "week3.session": async (step) => {
    await session(step, 3, JOINED);
    await draft(step, "luca", 3);
  },

  "dan.badge": async (step) => {
    const dan = await personOf(step.ctx, step.orgId, "dan");
    if (!dan) return;
    await progress(step, "dan", 3, 100);
    // The product's one writer: Dan's slug is dan-okafor-ai-fundamentals.
    await issueBadge(step.ctx, dan, step.at);
  },

  "week4.projects": async (step) => {
    for (const key of PRESENT_ORDER) await save(step, key);
  },

  // Does what "Present to team" does (Ruling 4): sharing and presentedAt
  // together, for each saved project nobody has presented yet.
  "week4.present": async (step) => {
    const { ctx, orgId, at } = step;
    const sprint = await sprintOf(ctx, orgId);
    let slot = 0;
    for (const key of PRESENT_ORDER) {
      const person = await personOf(ctx, orgId, key);
      const project = person && (await projectOf(ctx, person._id, sprint._id));
      if (
        !project ||
        project.status !== "saved" ||
        project.presentedAt !== undefined
      ) {
        continue;
      }
      // Renamed by the tester: it's theirs to present, as in `dan.reflection`.
      if (key === "dan" && project.title !== PROJECTS.dan.title) continue;
      const when = at + slot * 60_000;
      await ctx.db.patch(project._id, { sharing: "team", presentedAt: when });
      slot += 1;
      await log({ ...step, at: when }, "project.presented");
    }
  },

  "week4.session": (step) => session(step, 4, JOINED),

  // Due at 3:01 PM, just after the week 4 hour ends.
  "sprint.complete": async ({ ctx, orgId, at }) => {
    const sprint = await sprintOf(ctx, orgId);
    if (sprint.completedAt !== undefined) return;
    await ctx.db.patch(sprint._id, { completedAt: at });
  },

  "week4.after": (step) => checkIn(step, "after", JOINED),

  "dan.reflection": async (step) => {
    const { ctx, orgId } = step;
    const dan = await personOf(ctx, orgId, "dan");
    if (!dan) return;
    const sprint = await sprintOf(ctx, orgId);
    const project = await projectOf(ctx, dan._id, sprint._id);
    // Renamed by the tester: it's their project now, not the canonical one.
    if (
      !project ||
      project.status !== "saved" ||
      project.title !== PROJECTS.dan.title
    ) {
      return;
    }
    if (project.learned === undefined || project.howChecked === undefined) {
      await ctx.db.patch(project._id, {
        learned: project.learned ?? DAN_LEARNED,
        howChecked: project.howChecked ?? DAN_HOW_CHECKED,
      });
    }
    const badge = await badgeOf(ctx, dan._id);
    // Dan's setting decides whether his credential shows it (Ruling 10).
    if (
      badge &&
      badge.reflectionProjectId === undefined &&
      (await settingsOf(ctx, dan._id)).reflectionsOnCredential
    ) {
      await ctx.db.patch(badge._id, { reflectionProjectId: project._id });
    }
  },
};

export const isStepKey = (key: string): key is StepKey =>
  Object.hasOwn(STEPS, key);
