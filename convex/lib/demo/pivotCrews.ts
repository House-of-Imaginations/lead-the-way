import { literals } from "convex-helpers/validators";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { wipeCareers } from "../../careers/wipe";
import { ensureProfile } from "../account/ensureProfile";
import { throwUserError } from "../errors";
import { zoned } from "../sprintTime";
import { CAREER_CAST, demoUserId } from "./cast";
import { DEMO_TIME_ZONE } from "./schedule";

/**
 * The Change careers demo (spec 7, careers `data-model.md` "Cast and
 * values"): Footscray Library, Amara's Data Analyst crew with Lena, and
 * Kofi's Business Analyst crew. Example data throughout. Times are
 * Melbourne wall-clock times, AEDT here, through the zone helper.
 */
const at = (date: string, time: string) => zoned(date, time, DEMO_TIME_ZONE);

/** Where the careers clock can jump to. A reset starts it at `week1`. */
export const CAREER_TARGETS = {
  week1: at("2026-10-26", "09:00"),
  week2: at("2026-11-03", "12:00"),
  week3: at("2026-11-10", "12:00"),
  proof: at("2026-11-16", "12:00"),
} as const;
type ClockTarget = keyof typeof CAREER_TARGETS;
export const careerTargetValidator = literals(
  "week1",
  "week2",
  "week3",
  "proof",
  "missedWeek",
);
export type CareerTarget = ClockTarget | "missedWeek";

const AMARA_TASK = "Tidy four store sales exports and show weekly trends.";

const RULES = [
  "Protect the hours you picked",
  "Share one thing you tried",
  "Use AI openly and say how",
  "No judgement, ever",
];
const SUGGESTIONS = [
  "Camera optional on check-ins",
  "Message the crew if you will miss a week",
];

/** One per learner, the handoff's defaults. */
const SETTINGS = {
  showDoneToCrew: true,
  guideSeesProgress: true,
  reflectionOnProof: true,
  researchOptIn: false,
  learningHour: true,
  crewCheckIn: true,
  missedWeekNudge: true,
  sundaySummary: true,
  listenInstead: false,
};

/** Profile-only crew members: seeded user ids, never login accounts. */
const DATA_CREW = [
  ["jordan", "Jordan", "Cleaning a council survey export"],
  ["sofia", "Sofia", "Rostering costs by week"],
  ["tevita", "Tevita", "Café sales by hour"],
  ["raj", "Raj", "Library visitor trends"],
] as const;
// ponytail: spec 6.3 asks for three members and names none; these are drafts.
const BA_CREW = [
  ["nina", "Nina"],
  ["theo", "Theo"],
  ["farah", "Farah"],
] as const;

async function castUserId(ctx: MutationCtx, key: string): Promise<string> {
  const person = CAREER_CAST.find((p) => p.key === key)!;
  const id = await demoUserId(ctx, person.email);
  if (!id) {
    throwUserError(
      "DEMO_NOT_SEEDED",
      "The careers demo accounts are missing. Run seed:reset from the terminal first.",
    );
  }
  return id;
}

/**
 * Wipe every career row and write the careers demo as it stands at `week1`,
 * Monday 26 October, 9:00 AM (spec 11.2). Accounts survive, and Dan is left
 * team-only (D4). One mutation, so a reset is all or nothing.
 */
export async function writePivotCrews(ctx: MutationCtx): Promise<number> {
  const cleared = await wipeCareers(ctx);
  const week1 = CAREER_TARGETS.week1;
  const partnerId = await ctx.db.insert("careerPartners", {
    slug: "footscray-library",
    name: "Footscray Library",
    kind: "library",
  });
  await ctx.db.insert("careerDemo", { now: week1, missedWeek: false });

  const userIds: Record<string, string> = {};
  for (const person of CAREER_CAST) {
    const userId = await castUserId(ctx, person.key);
    const profile = await ensureProfile(ctx, userId);
    await ctx.db.patch(profile._id, { displayName: person.name });
    userIds[person.key] = userId;
  }
  const guide = (key: string, firstName: string, guideBio: string) =>
    ctx.db.insert("careerProfiles", {
      userId: userIds[key]!,
      kind: "guide",
      firstName,
      guideBio,
      timezone: DEMO_TIME_ZONE,
      private: false,
    });
  const lena = await guide(
    "lena",
    "Lena",
    "Data Analyst at a logistics company. Changed careers from hospitality in 2023.",
  );
  const kofi = await guide(
    "kofi",
    "Kofi",
    "Business Analyst at a bank. Changed careers from sales in 2022.",
  );

  const learner = async (
    userId: string,
    firstName: string,
    targetRole: Doc<"careerProfiles">["targetRole"],
    currentRole?: string,
  ) => {
    const id = await ctx.db.insert("careerProfiles", {
      userId,
      kind: "learner",
      firstName,
      currentRole,
      targetRole,
      hoursPerWeek: 2,
      consentAt: at("2026-10-19", "19:30"),
      partnerId,
      timezone: DEMO_TIME_ZONE,
      a11y: { captions: false, transcripts: false, audioFirst: false },
      private: false,
    });
    await ctx.db.insert("careerSettings", { careerProfileId: id, ...SETTINGS });
    return id;
  };
  const crew = async (
    guideId: Id<"careerProfiles">,
    targetRole: Doc<"crews">["targetRole"],
    credentialId: Doc<"crews">["credentialId"],
    checkInDay: number,
    members: Id<"careerProfiles">[],
  ) => {
    const crewId = await ctx.db.insert("crews", {
      guideId,
      targetRole,
      credentialId,
      checkInDay,
      checkInTime: "19:00",
      startsOn: "2026-10-26",
      capacity: 5,
    });
    for (const careerProfileId of members) {
      await ctx.db.insert("crewMembers", {
        crewId,
        careerProfileId,
        joinedAt: at("2026-10-20", "10:00"),
        agreedAt: at("2026-10-25", "18:00"),
      });
    }
    for (const text of RULES) {
      await ctx.db.insert("crewRules", {
        crewId,
        text,
        source: "guide",
        status: "active",
      });
    }
    for (const text of SUGGESTIONS) {
      await ctx.db.insert("crewRules", {
        crewId,
        text,
        source: "guide",
        status: "suggested",
      });
    }
    return crewId;
  };

  // Amara's crew: five learners and Lena, Tuesdays 7 to 8 PM.
  const amara = await learner(
    userIds.amara!,
    "Amara",
    "data-analyst",
    "Retail Store Manager",
  );
  const data: [Id<"careerProfiles">, string, string?][] = [
    [amara, "Sales dashboard, Western suburbs stores", AMARA_TASK],
  ];
  for (const [key, firstName, title] of DATA_CREW) {
    data.push([await learner(`seed-${key}`, firstName, "data-analyst"), title]);
  }
  const amaraCrew = await crew(
    lena,
    "data-analyst",
    "data-fundamentals",
    2,
    data.map(([id]) => id),
  );
  await ctx.db.insert("protectedHours", {
    careerProfileId: amara,
    days: [4, 0],
    startTime: "20:00",
    calendarHold: true,
  });
  await complete(ctx, amara, [
    [1, at("2026-10-22", "20:00")],
    [2, at("2026-10-22", "20:15")],
    [3, at("2026-10-25", "20:00")],
  ]);
  const demoDayId = await ctx.db.insert("demoDays", {
    crewId: amaraCrew,
    at: at("2026-11-10", "19:00"),
  });
  for (const [careerProfileId, title, task] of data) {
    const projectId = await ctx.db.insert("careerProjects", {
      careerProfileId,
      credentialId: "data-fundamentals",
      title,
      task: task ?? title,
      whatIDid: "",
      reflection: "",
      skills: [],
      addReflectionToProof: false,
    });
    await ctx.db.insert("presentations", {
      demoDayId,
      projectId,
      careerProfileId,
    });
  }

  // Kofi's crew: three learners, Thursdays 7 to 8 PM.
  const ba = [];
  for (const [key, firstName] of BA_CREW) {
    ba.push(await learner(`seed-${key}`, firstName, "business-analyst"));
  }
  await crew(kofi, "business-analyst", "business-analysis-fundamentals", 4, ba);
  return cleared;
}

/** Data Fundamentals lessons done, by number, each once. */
async function complete(
  ctx: MutationCtx,
  careerProfileId: Id<"careerProfiles">,
  lessons: [number, number][],
) {
  const done = new Set(
    (
      await ctx.db
        .query("lessonProgress")
        .withIndex("by_careerProfile", (q) =>
          q.eq("careerProfileId", careerProfileId),
        )
        .take(100)
    ).map((row) => row.lessonId),
  );
  for (const [n, completedAt] of lessons) {
    const lessonId = `data-fundamentals-${n}`;
    if (done.has(lessonId)) continue;
    await ctx.db.insert("lessonProgress", {
      careerProfileId,
      lessonId,
      completedAt,
    });
  }
}

async function profileOfCast(ctx: MutationCtx, key: string) {
  const userId = await castUserId(ctx, key);
  const profile = await ctx.db
    .query("careerProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) {
    throwUserError(
      "DEMO_NOT_SEEDED",
      "Seed the demo first: pnpm exec convex run seed:reset.",
    );
  }
  return profile;
}

/**
 * What happens to Amara between the targets, played once as the clock
 * passes each, so nothing shows before its date. Amara's own Lena-side
 * rows (review, endorsement) come from here, as guides have no screens.
 */
const STEPS: Record<
  Exclude<ClockTarget, "week1">,
  (ctx: MutationCtx) => Promise<void>
> = {
  week2: async (ctx) => {
    const amara = await profileOfCast(ctx, "amara");
    await complete(ctx, amara._id, [[4, at("2026-10-29", "20:12")]]);
  },
  week3: async (ctx) => {
    const amara = await profileOfCast(ctx, "amara");
    await complete(ctx, amara._id, [
      [5, at("2026-11-01", "20:00")],
      [6, at("2026-11-05", "20:00")],
      [7, at("2026-11-08", "20:00")],
    ]);
    const project = await amaraProject(ctx, amara._id);
    await ctx.db.patch(project._id, {
      whatIDid:
        "Cleaned 1,248 rows in Excel, built the dashboard, checked every total by hand.",
      reflection:
        "Cleaning took longer than the charts. I checked every total by hand before trusting the AI suggestions.",
      skills: ["Data cleaning", "Excel", "Data visualisation"],
      addReflectionToProof: true,
    });
  },
  proof: async (ctx) => {
    const amara = await profileOfCast(ctx, "amara");
    const lena = await profileOfCast(ctx, "lena");
    await complete(ctx, amara._id, [
      [8, at("2026-11-12", "20:00")],
      [9, at("2026-11-12", "20:20")],
      [10, at("2026-11-15", "20:00")],
      [11, at("2026-11-15", "20:30")],
    ]);
    const project = await amaraProject(ctx, amara._id);
    await ctx.db.patch(project._id, {
      reviewedBy: lena._id,
      reviewedAt: at("2026-11-12", "10:00"),
    });
    const presentations = await ctx.db
      .query("presentations")
      .withIndex("by_careerProfile", (q) => q.eq("careerProfileId", amara._id))
      .take(10);
    for (const row of presentations) {
      if (row.presentedAt === undefined)
        await ctx.db.patch(row._id, { presentedAt: at("2026-11-10", "19:05") });
    }
    await ctx.db.insert("careerBadges", {
      userId: amara.userId,
      credentialId: "data-fundamentals",
      earnedAt: at("2026-11-16", "09:00"),
    });
    await ctx.db.insert("endorsements", {
      userId: amara.userId,
      guideId: lena._id,
      credentialId: "data-fundamentals",
      text: "Built a clean, accurate dashboard from real sales data, and explained every choice.",
    });
    await ctx.db.insert("confidence", {
      careerProfileId: amara._id,
      credentialId: "data-fundamentals",
      value: 4,
      at: at("2026-11-16", "09:00"),
    });
  },
};

async function amaraProject(
  ctx: MutationCtx,
  careerProfileId: Id<"careerProfiles">,
) {
  const project = await ctx.db
    .query("careerProjects")
    .withIndex("by_careerProfile", (q) =>
      q.eq("careerProfileId", careerProfileId),
    )
    .first();
  if (!project) {
    throwUserError(
      "DEMO_NOT_SEEDED",
      "Seed the demo first: pnpm exec convex run seed:reset.",
    );
  }
  return project;
}

/**
 * Move the careers clock forward, playing each step it passes once, or set
 * the missed-week flag. Never backwards; only a reset goes back. The caller
 * has checked DEMO_MODE and a demo account.
 */
export async function moveCareerClock(
  ctx: MutationCtx,
  target: CareerTarget,
): Promise<{ now: number; missedWeek: boolean }> {
  const clock = await ctx.db.query("careerDemo").first();
  if (!clock) {
    throwUserError(
      "DEMO_NOT_SEEDED",
      "Seed the demo first: pnpm exec convex run seed:reset.",
    );
  }
  const from = clock.now ?? CAREER_TARGETS.week1;
  if (target === "missedWeek") {
    await ctx.db.patch(clock._id, { missedWeek: true });
    return { now: from, missedWeek: true };
  }
  const to = CAREER_TARGETS[target];
  if (to < from) {
    throwUserError(
      "DEMO_CLOCK_BACKWARDS",
      "The demo clock only moves forward. Reset the demo to start again.",
    );
  }
  for (const [key, step] of Object.entries(STEPS)) {
    const due = CAREER_TARGETS[key as ClockTarget];
    if (from < due && due <= to) await step(ctx);
  }
  await ctx.db.patch(clock._id, { now: to });
  return { now: to, missedWeek: clock.missedWeek };
}
