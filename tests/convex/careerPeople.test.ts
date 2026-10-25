import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { harness, seat, workspace, type T } from "./workspace/helpers";

/** Wednesday of the crew's week 2 (it starts Monday 26 October 2026). */
const WEEK_2 = Date.parse("2026-11-04T09:00:00Z");

/**
 * P12b Task 6: demo day, proof, guide, partners, career settings, and the
 * shared `home.summary` and `privacy.*`. Each function is called as the
 * owner, another learner, the guide and signed out (P11).
 */

const DEFAULTS = {
  showDoneToCrew: true,
  guideSeesProgress: true,
  reflectionOnProof: true,
  researchOptIn: false,
  learningHour: true,
  crewCheckIn: true,
  missedWeekNudge: true,
  sundaySummary: false,
  listenInstead: false,
};

/** A learner profile with its settings row, or a guide profile. */
async function addProfile(
  t: T,
  userId: string,
  firstName: string,
  kind: "learner" | "guide" = "learner",
  extra: Record<string, unknown> = {},
): Promise<Id<"careerProfiles">> {
  return await t.run(async (ctx) => {
    const id = await ctx.db.insert("careerProfiles", {
      userId,
      kind,
      firstName,
      private: false,
      ...extra,
    });
    if (kind === "learner") {
      await ctx.db.insert("careerSettings", {
        careerProfileId: id,
        ...DEFAULTS,
      });
    }
    return id;
  });
}

/** Lena guides a crew of Amara and Jordan. Raj is a learner in no crew. */
async function crewWorld() {
  const t = harness();
  const lena = await addProfile(t, "user_lena", "Lena", "guide", {
    guideBio: "Data Analyst",
  });
  const amara = await addProfile(t, "user_amara", "Amara", "learner", {
    currentRole: "Retail Store Manager",
    targetRole: "data-analyst",
    hoursPerWeek: 2,
    consentAt: 1,
  });
  const jordan = await addProfile(t, "user_jordan", "Jordan");
  const raj = await addProfile(t, "user_raj", "Raj");
  const ids = await t.run(async (ctx) => {
    const crewId = await ctx.db.insert("crews", {
      guideId: lena,
      targetRole: "data-analyst",
      credentialId: "data-fundamentals",
      checkInDay: 2,
      checkInTime: "19:00",
      startsOn: "2026-10-26",
      capacity: 6,
    });
    for (const careerProfileId of [amara, jordan]) {
      await ctx.db.insert("crewMembers", {
        crewId,
        careerProfileId,
        joinedAt: 0,
      });
    }
    await ctx.db.insert("demoDays", { crewId, at: 1_700_000_000_000 });
    const project = await ctx.db.insert("careerProjects", {
      careerProfileId: amara,
      credentialId: "data-fundamentals",
      task: "Tidy four store sales exports and show weekly trends.",
      whatIDid: "Cleaned 1,248 rows in Excel.",
      reflection: "Cleaning took longer than the charts.",
      skills: ["Data cleaning", "Excel"],
      addReflectionToProof: true,
    });
    const rajProject = await ctx.db.insert("careerProjects", {
      careerProfileId: raj,
      credentialId: "data-fundamentals",
      task: "Library visitor trends.",
      whatIDid: "",
      reflection: "",
      skills: [],
      addReflectionToProof: true,
    });
    await ctx.db.insert("lessonProgress", {
      careerProfileId: amara,
      lessonId: "data-fundamentals-1",
      completedAt: WEEK_2,
    });
    await ctx.db.insert("careerBadges", {
      userId: "user_amara",
      credentialId: "data-fundamentals",
      earnedAt: 2,
    });
    await ctx.db.insert("endorsements", {
      userId: "user_amara",
      guideId: lena,
      credentialId: "data-fundamentals",
      text: "Built a clean, accurate dashboard.",
    });
    await ctx.db.insert("confidence", {
      careerProfileId: amara,
      credentialId: "data-fundamentals",
      value: 4,
      at: 3,
    });
    return { crewId, project, rajProject };
  });
  const as = (subject: string) => t.withIdentity({ subject });
  return {
    t,
    ...ids,
    ids: { lena, amara, jordan, raj },
    amara: as("user_amara"),
    jordan: as("user_jordan"),
    raj: as("user_raj"),
    lena: as("user_lena"),
  };
}

/** The error code a call refused with, or "ok". */
const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: { data?: { code?: string } }) => e.data?.code ?? String(e),
  );

test("demo day: session lists only who chose to present, by first name and task", async () => {
  const { t, amara, jordan, raj, lena } = await crewWorld();
  const before = await amara.query(api.careers.demoDay.session, {});
  expect(before?.presenting).toEqual([]);
  expect(before?.mine).toEqual({
    task: "Tidy four store sales exports and show weekly trends.",
    whatIDid: "Cleaned 1,248 rows in Excel.",
    reflection: "Cleaning took longer than the charts.",
    addReflectionToProof: true,
    reviewedBy: null,
  });
  await amara.mutation(api.careers.demoDay.present, {});
  await amara.mutation(api.careers.demoDay.present, {}); // a repeat is a no-op
  const shown = {
    firstName: "Amara",
    initials: "A",
    task: "Tidy four store sales exports and show weekly trends.",
  };
  expect(
    (await amara.query(api.careers.demoDay.session, {}))?.presenting,
  ).toEqual([{ ...shown, you: true }]);
  // Another member and the guide see the same list, and no project of their own.
  const asJordan = await jordan.query(api.careers.demoDay.session, {});
  expect(asJordan?.presenting).toEqual([{ ...shown, you: false }]);
  expect(asJordan?.mine).toBeNull();
  expect((await lena.query(api.careers.demoDay.session, {}))?.mine).toBeNull();
  // Not in a crew: nothing.
  expect(await raj.query(api.careers.demoDay.session, {})).toBeNull();
  // Writes reach only the caller's own project.
  expect(await codeOf(jordan.mutation(api.careers.demoDay.present, {}))).toBe(
    "NOT_FOUND",
  );
  expect(
    await codeOf(
      lena.mutation(api.careers.demoDay.saveReflection, { reflection: "x" }),
    ),
  ).toBe("NO_CAREER_TRACK");
  expect(await codeOf(raj.mutation(api.careers.demoDay.present, {}))).toBe(
    "NOT_FOUND",
  );
  await amara.mutation(api.careers.demoDay.saveReflection, {
    reflection: "I checked every total.",
  });
  await amara.mutation(api.careers.demoDay.setAddToProof, { on: false });
  const own = await amara.query(api.careers.demoDay.session, {});
  expect(own?.mine).toMatchObject({
    reflection: "I checked every total.",
    addReflectionToProof: false,
  });
  expect(
    await codeOf(
      amara.mutation(api.careers.demoDay.saveReflection, {
        reflection: "x".repeat(2001),
      }),
    ),
  ).toBe("PROJECT_TOO_LONG");
  expect(await codeOf(t.query(api.careers.demoDay.session, {}))).toBe(
    "NOT_SIGNED_IN",
  );
  expect(
    await codeOf(t.mutation(api.careers.demoDay.setAddToProof, { on: true })),
  ).toBe("NOT_SIGNED_IN");
});

test("P5: public proof shows the reflection only with both switches on, never confidence", async () => {
  const { t, amara, jordan, lena } = await crewWorld();
  const slug = await amara.mutation(api.careers.proof.createProofLink, {
    credentialId: "data-fundamentals",
  });
  expect(
    await amara.mutation(api.careers.proof.createProofLink, {
      credentialId: "data-fundamentals",
    }),
  ).toBe(slug);
  const page = await t.query(api.careers.proof.publicProof, { slug });
  expect(page).toEqual({
    firstName: "Amara",
    badge: { name: "Data Fundamentals", earnedAt: 2 },
    project: {
      task: "Tidy four store sales exports and show weekly trends.",
      skills: ["Data cleaning", "Excel"],
      reflection: "Cleaning took longer than the charts.",
    },
    endorsement: {
      text: "Built a clean, accurate dashboard.",
      guide: { firstName: "Lena", bio: "Data Analyst" },
    },
  });
  // Never confidence, lessons or crew, whoever asks.
  for (const who of [t, jordan, lena]) {
    const json = JSON.stringify(
      await who.query(api.careers.proof.publicProof, { slug }),
    );
    expect(json).not.toMatch(/confidence|lesson|crew|Jordan/i);
  }
  await amara.mutation(api.careers.careerSettings.set, {
    key: "reflectionOnProof",
    on: false,
  });
  expect(
    (await t.query(api.careers.proof.publicProof, { slug }))?.project
      ?.reflection,
  ).toBeNull();
  await amara.mutation(api.careers.careerSettings.set, {
    key: "reflectionOnProof",
    on: true,
  });
  await amara.mutation(api.careers.demoDay.setAddToProof, { on: false });
  expect(
    (await t.query(api.careers.proof.publicProof, { slug }))?.project
      ?.reflection,
  ).toBeNull();
  expect(
    await t.query(api.careers.proof.publicProof, { slug: "nobody" }),
  ).toBeNull();
});

test("proof: mine, rateConfidence and createProofLink are the learner's own", async () => {
  const { t, amara, jordan, lena } = await crewWorld();
  const mine = await amara.query(api.careers.proof.mine, {});
  expect(mine.badges).toEqual([
    {
      credentialId: "data-fundamentals",
      name: "Data Fundamentals",
      earnedAt: 2,
    },
  ]);
  expect(mine.confidence).toEqual([
    { credentialId: "data-fundamentals", value: 4 },
  ]);
  await amara.mutation(api.careers.proof.rateConfidence, {
    credentialId: "data-fundamentals",
    value: 5,
  });
  expect((await amara.query(api.careers.proof.mine, {})).confidence).toEqual([
    { credentialId: "data-fundamentals", value: 5 },
  ]);
  expect(
    await codeOf(
      amara.mutation(api.careers.proof.rateConfidence, {
        credentialId: "data-fundamentals",
        value: 6,
      }),
    ),
  ).toBe("FIELD_REQUIRED");
  // Another learner sees only their own: none of Amara's rows.
  expect(await jordan.query(api.careers.proof.mine, {})).toEqual({
    badges: [],
    project: null,
    endorsements: [],
    confidence: [],
    links: [],
  });
  expect(
    await codeOf(
      jordan.mutation(api.careers.proof.createProofLink, {
        credentialId: "data-fundamentals",
      }),
    ),
  ).toBe("BADGE_MISSING");
  expect(await codeOf(lena.query(api.careers.proof.mine, {}))).toBe(
    "NO_CAREER_TRACK",
  );
  expect(await codeOf(t.query(api.careers.proof.mine, {}))).toBe(
    "NOT_SIGNED_IN",
  );
});

test("P3: the guide sees progress only with permission, and only their crew", async () => {
  const { t, ids, project, rajProject, amara, raj, lena } = await crewWorld();
  // The careers clock in week 2, the week of Amara's only lesson: she is back.
  vi.stubEnv("DEMO_MODE", "on");
  await t.run((ctx) =>
    ctx.db.insert("careerDemo", { now: WEEK_2, missedWeek: false }),
  );
  const learners = await lena.query(api.careers.guide.myLearners, {});
  vi.unstubAllEnvs();
  expect(learners).toEqual([
    {
      careerProfileId: ids.amara,
      firstName: "Amara",
      initials: "A",
      weekly: "back",
      progress: { done: 1, total: 11 },
      project: {
        projectId: project,
        task: "Tidy four store sales exports and show weekly trends.",
        reviewed: false,
      },
    },
    {
      careerProfileId: ids.jordan,
      firstName: "Jordan",
      initials: "J",
      weekly: "notYet",
      progress: { done: 0, total: 11 },
      project: null,
    },
  ]);
  // Never role, hours, confidence or research answers.
  expect(JSON.stringify(learners)).not.toMatch(
    /Retail|hours|confidence|research/i,
  );
  await amara.mutation(api.careers.careerSettings.set, {
    key: "guideSeesProgress",
    on: false,
  });
  await amara.mutation(api.careers.careerSettings.set, {
    key: "showDoneToCrew",
    on: false,
  });
  expect((await lena.query(api.careers.guide.myLearners, {}))[0]).toMatchObject(
    { weekly: null, progress: null },
  );
  // Endorse and review: the guide's own crew only.
  await lena.mutation(api.careers.guide.endorse, {
    careerProfileId: ids.amara,
    credentialId: "data-fundamentals",
    text: " Explained every choice. ",
  });
  await lena.mutation(api.careers.guide.reviewProject, { projectId: project });
  const endorsed = await t.run((ctx) => ctx.db.query("endorsements").collect());
  expect(endorsed.map((e) => e.text)).toEqual(["Explained every choice."]);
  expect(
    (await amara.query(api.careers.demoDay.session, {}))?.mine,
  ).toMatchObject({ reviewedBy: "Lena" });
  expect(
    await codeOf(
      lena.mutation(api.careers.guide.endorse, {
        careerProfileId: ids.raj,
        credentialId: "data-fundamentals",
        text: "Good",
      }),
    ),
  ).toBe("NOT_FOUND");
  expect(
    await codeOf(
      lena.mutation(api.careers.guide.reviewProject, {
        projectId: rajProject,
      }),
    ),
  ).toBe("NOT_FOUND");
  // A learner is not a guide.
  expect(await codeOf(amara.query(api.careers.guide.myLearners, {}))).toBe(
    "FORBIDDEN",
  );
  expect(
    await codeOf(
      raj.mutation(api.careers.guide.reviewProject, { projectId: project }),
    ),
  ).toBe("FORBIDDEN");
  expect(await codeOf(t.query(api.careers.guide.myLearners, {}))).toBe(
    "NOT_SIGNED_IN",
  );
});

test("P4: partner totals count opted-in learners only, hidden below 5", async () => {
  const t = harness();
  const partnerId = await t.run((ctx) =>
    ctx.db.insert("careerPartners", {
      slug: "footscray-library",
      name: "Footscray Library",
      kind: "library",
    }),
  );
  expect(
    await t.query(api.careers.partners.bySlug, { slug: "footscray-library" }),
  ).toEqual({ name: "Footscray Library", kind: "library" });
  const join = async (n: number, researchOptIn: boolean) => {
    const id = await addProfile(t, `user_${n}`, `L${n}`, "learner", {
      partnerId,
      targetRole: "data-analyst",
    });
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("careerSettings")
        .withIndex("by_careerProfile", (q) => q.eq("careerProfileId", id))
        .unique();
      await ctx.db.patch(row!._id, { researchOptIn });
    });
  };
  for (let n = 1; n <= 4; n++) await join(n, true);
  await join(9, false); // not opted in: never counted
  const slug = { slug: "footscray-library" };
  const hidden = {
    mapsBuilt: "hidden",
    accounts: "hidden",
    crewsJoined: "hidden",
    credentialsEarned: "hidden",
  };
  expect(await t.query(api.careers.partners.totals, slug)).toEqual(hidden);
  await join(5, true);
  expect(await t.query(api.careers.partners.totals, slug)).toEqual({
    ...hidden,
    mapsBuilt: 5,
    accounts: 5,
  });
  // The same for any caller, signed in or not.
  const someone = t.withIdentity({ subject: "user_1" });
  expect(await someone.query(api.careers.partners.totals, slug)).toEqual(
    await t.query(api.careers.partners.totals, slug),
  );
  expect(
    await t.query(api.careers.partners.totals, { slug: "nobody" }),
  ).toBeNull();
});

test("P8: deleteAnswers clears the answers and the draft, keeps badges, projects and endorsements", async () => {
  const { t, ids, amara, jordan, lena } = await crewWorld();
  const token = await t.mutation(api.careers.drafts.saveAnswers, {
    currentRole: "Retail Store Manager",
    targetRole: "data-analyst",
    hoursPerWeek: 2,
    consent: true,
  });
  expect(
    (await amara.query(api.careers.careerSettings.mine, {})).answers,
  ).toEqual({
    currentRole: "Retail Store Manager",
    targetRole: "data-analyst",
    hoursPerWeek: 2,
  });
  await amara.mutation(api.careers.careerSettings.deleteAnswers, {
    draftToken: token,
  });
  const after = await t.run(async (ctx) => ({
    profile: await ctx.db.get(ids.amara),
    drafts: await ctx.db.query("mapDrafts").collect(),
    badges: await ctx.db.query("careerBadges").collect(),
    projects: await ctx.db.query("careerProjects").collect(),
    endorsements: await ctx.db.query("endorsements").collect(),
    events: await ctx.db.query("careerEvents").collect(),
  }));
  expect(after.profile).not.toHaveProperty("currentRole");
  expect(after.profile).not.toHaveProperty("targetRole");
  expect(after.profile).not.toHaveProperty("hoursPerWeek");
  expect(after.profile).not.toHaveProperty("consentAt");
  expect(after.drafts).toEqual([]);
  expect(after.badges).toHaveLength(1);
  expect(after.projects).toHaveLength(2);
  expect(after.endorsements).toHaveLength(1);
  // P10: the event has no person in it.
  const deleted = after.events.find((e) => e.name === "answersDeleted")!;
  expect(Object.keys(deleted).sort()).toEqual([
    "_creationTime",
    "_id",
    "at",
    "name",
  ]);
  // Jordan's settings are untouched by Amara's.
  expect(
    (await jordan.query(api.careers.careerSettings.mine, {})).settings,
  ).toEqual(DEFAULTS);
  expect(await codeOf(lena.query(api.careers.careerSettings.mine, {}))).toBe(
    "NO_CAREER_TRACK",
  );
  expect(
    await codeOf(
      lena.mutation(api.careers.careerSettings.set, {
        key: "researchOptIn",
        on: true,
      }),
    ),
  ).toBe("NO_CAREER_TRACK");
  expect(
    await codeOf(t.mutation(api.careers.careerSettings.deleteAnswers, {})),
  ).toBe("NOT_SIGNED_IN");
});

test("X4: home.summary and privacy.* answer for the signed-in account only", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  // The owner is two-track: a seat and a private learner profile.
  await addProfile(t, "user_owner", "Priya", "learner", {
    private: true,
    currentRole: "Account Executive",
    targetRole: "data-analyst",
  });
  const { as: teamOnly } = await seat(t, orgId, "user_lee", []);
  await addProfile(t, "user_lena", "Lena", "guide");
  const guide = t.withIdentity({ subject: "user_lena" });

  const home = await owner.query(api.home.summary, {});
  expect(home.team).toEqual({ orgName: "Aster Network", sprint: null });
  expect(home.career).toEqual({
    private: true,
    currentRole: "Account Executive",
    targetRole: "Data Analyst",
    credential: "Data Fundamentals",
    step: { n: 1, of: 3 },
    lessonsDone: 0,
    lessonsTotal: 11,
    checkIn: null,
    guide: null,
  });
  expect(home.whoSeesWhat).toHaveLength(4);
  const lee = await teamOnly.query(api.home.summary, {});
  expect(lee.career).toBeNull();
  expect(lee.whoSeesWhat.every((r) => r.career === null)).toBe(true);
  // A guide profile is not a track: no learner track, so an error.
  expect(await codeOf(guide.query(api.home.summary, {}))).toBe(
    "NO_CAREER_TRACK",
  );
  expect(await codeOf(guide.query(api.privacy.byTrack, {}))).toBe(
    "NO_CAREER_TRACK",
  );
  expect(await codeOf(t.query(api.home.summary, {}))).toBe("NOT_SIGNED_IN");
  expect(await codeOf(t.query(api.privacy.byTrack, {}))).toBe("NOT_SIGNED_IN");

  expect(await owner.query(api.privacy.byTrack, {})).toEqual({
    team: {
      orgName: "Aster Network",
      manager: expect.any(String),
      threshold: 5,
      settings: {
        askBeforeSharing: true,
        reflectionsOnCredential: true,
        includeInTeamTotals: true,
      },
    },
    career: {
      private: true,
      guide: null,
      settings: {
        showDoneToCrew: true,
        guideSeesProgress: true,
        reflectionOnProof: true,
      },
    },
  });
  await owner.mutation(api.privacy.setTeam, {
    key: "includeInTeamTotals",
    on: false,
    expectOrgId: orgId,
  });
  await owner.mutation(api.privacy.setCareer, {
    key: "showDoneToCrew",
    on: false,
  });
  const after = await owner.query(api.privacy.byTrack, {});
  expect(after.team?.settings.includeInTeamTotals).toBe(false);
  expect(after.career?.settings.showDoneToCrew).toBe(false);
  // The team-only account's own row is untouched, and it has no career column.
  const leeView = await teamOnly.query(api.privacy.byTrack, {});
  expect(leeView.team?.settings.includeInTeamTotals).toBe(true);
  expect(leeView.career).toBeNull();
  expect(
    await codeOf(
      teamOnly.mutation(api.privacy.setCareer, {
        key: "showDoneToCrew",
        on: false,
      }),
    ),
  ).toBe("NO_CAREER_TRACK");
  expect(
    await codeOf(
      guide.mutation(api.privacy.setTeam, {
        key: "includeInTeamTotals",
        on: false,
        expectOrgId: orgId,
      }),
    ),
  ).toBe("NO_WORKSPACE");
  const { orgId: other } = await workspace(t, "Birch Studio");
  expect(
    await codeOf(
      teamOnly.mutation(api.privacy.setTeam, {
        key: "includeInTeamTotals",
        on: false,
        expectOrgId: other,
      }),
    ),
  ).toBe("WORKSPACE_CHANGED");
});
