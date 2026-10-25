import { readFileSync, readdirSync } from "node:fs";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { seedAuthUser } from "./testHelpers";
import {
  addCareer,
  calderLane,
  clock,
  harness,
  seat,
  workspace,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const HOME = "dan@pivotcrews.example";

test("X3: startPrivate refuses the login address and any workplace domain", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2"); // Dan is seated from week 1.
  const dan = as("dan");
  const start = (contactEmail: string) =>
    dan.mutation(api.careers.tracks.startPrivate, { contactEmail });
  const codes: Record<string, unknown> = {};
  for (const address of [
    "not an address",
    "dan.okafor@calderlane.com.au",
    "Someone@CalderLane.com.au",
  ]) {
    codes[address] = await start(address).then(
      () => "ok",
      (e: { data?: { code?: string } }) => e.data?.code,
    );
  }
  expect(codes).toEqual({
    "not an address": "CONTACT_EMAIL_INVALID",
    "dan.okafor@calderlane.com.au": "CONTACT_EMAIL_INVALID",
    "Someone@CalderLane.com.au": "CONTACT_EMAIL_INVALID",
  });
  // The login address on a personal domain, with no workspace at all.
  const pat = t.withIdentity(
    await seedAuthUser(t, {
      name: "Pat Lee",
      email: "pat@home.example",
      emailVerified: true,
    }),
  );
  await expect(
    pat.mutation(api.careers.tracks.startPrivate, {
      contactEmail: " PAT@home.example ",
    }),
  ).rejects.toMatchObject({
    data: { message: "Use a personal address, not the one you log in with." },
  });
  // A seat's domain counts though the workspace names none.
  const ws = harness();
  const { orgId } = await workspace(ws);
  const { as: lee } = await seat(ws, orgId, "user_lee", []);
  await expect(
    lee.mutation(api.careers.tracks.startPrivate, {
      contactEmail: "lee@example.com",
    }),
  ).rejects.toMatchObject({ data: { code: "CONTACT_EMAIL_INVALID" } });
  expect(
    await t.run((ctx) => ctx.db.query("careerProfiles").collect()),
  ).toEqual([]);
});

test("X3: the contact address is stored only on the career profile", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2");
  const dan = as("dan");
  const token = await t.mutation(api.careers.drafts.saveAnswers, {
    currentRole: "Account Executive",
    targetRole: "business-analyst",
    hoursPerWeek: 2,
    consent: true,
  });
  const before = await t.run(async (ctx) => ctx.db.query("people").collect());
  await dan.mutation(api.careers.tracks.startPrivate, {
    contactEmail: HOME,
    draftToken: token,
  });
  const profile = await t.run(async (ctx) =>
    ctx.db.query("careerProfiles").unique(),
  );
  expect(profile).toMatchObject({
    firstName: "Dan",
    private: true,
    contactEmail: HOME,
    targetRole: "business-analyst",
  });
  expect(await t.query(api.careers.drafts.get, { token })).toBeNull();
  expect(await t.run(async (ctx) => ctx.db.query("people").collect())).toEqual(
    before,
  );
  expect(JSON.stringify(before)).not.toContain(HOME);
  // One track per account; a guide profile is not a learner track to add to.
  await expect(
    dan.mutation(api.careers.tracks.startPrivate, { contactEmail: HOME }),
  ).rejects.toMatchObject({ data: { code: "CAREER_TRACK_EXISTS" } });
  const guide = as("priya");
  await addCareer(guide, "guide");
  await expect(
    guide.mutation(api.careers.tracks.startPrivate, {
      contactEmail: "priya@home.example",
    }),
  ).rejects.toMatchObject({ data: { code: "CAREER_TRACK_EXISTS" } });
});

/** Spec 6.2: every manager-facing query Priya can call. */
const MANAGER_QUERIES = [
  "manager:overview",
  "manager:outcomes",
  "members:list",
  "orgRoles:list",
  "invites:list",
  "invites:teamPreview",
  "sprints:current",
  "sprints:launchPage",
  "teams:current",
  "agreements:current",
  "showAndTell:board",
  "workspace:settings",
  "pathway:forViewer",
  "viewer:shell",
  "demo:status",
];

test("X2: Priya's queries are byte-identical whether or not Dan holds a private track", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2");
  const priya = as("priya");
  const read = async () => {
    const out: Record<string, string> = {};
    for (const name of MANAGER_QUERIES) {
      out[name] = JSON.stringify(
        await priya.query(makeFunctionReference<"query">(name), {}),
      );
    }
    return out;
  };
  const before = await read();
  // Every query answered, so equality means something.
  expect(Object.values(before).filter((s) => s === "null")).toEqual([]);
  await as("dan").mutation(api.careers.tracks.startPrivate, {
    contactEmail: HOME,
  });
  expect(await read()).toEqual(before);
});

test("X6, P8: deleteCareer empties the track and keeps badges and endorsements", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2");
  const dan = as("dan");
  const teamHome = await dan.query(api.viewer.home, {});
  const teamShell = await dan.query(api.viewer.shell, {});
  await dan.mutation(api.careers.tracks.startPrivate, { contactEmail: HOME });
  expect(await dan.query(api.viewer.shell, {})).toHaveProperty("career");
  const other = t.withIdentity({ subject: "user_other" });
  const otherId = await addCareer(other);
  await t.run(async (ctx) => {
    const id = (await ctx.db.query("careerProfiles").first())!._id;
    const guideId = await ctx.db.insert("careerProfiles", {
      userId: "user_guide",
      kind: "guide",
      firstName: "Kofi",
      private: false,
    });
    const crewId = await ctx.db.insert("crews", {
      guideId,
      targetRole: "business-analyst",
      credentialId: "business-analysis-fundamentals",
      checkInDay: 4,
      checkInTime: "19:00",
      startsOn: "2026-11-05",
      capacity: 6,
    });
    for (const careerProfileId of [id, otherId]) {
      await ctx.db.insert("crewMembers", {
        crewId,
        careerProfileId,
        joinedAt: 1,
      });
      const ruleId = await ctx.db.insert("crewRules", {
        crewId,
        text: "Cameras optional",
        source: "guide",
        status: "active",
      });
      await ctx.db.insert("ruleChoices", { ruleId, careerProfileId, on: true });
      await ctx.db.insert("protectedHours", {
        careerProfileId,
        days: [2],
        startTime: "19:00",
        calendarHold: true,
      });
      await ctx.db.insert("lessonProgress", {
        careerProfileId,
        lessonId: "business-analysis-fundamentals-1",
        completedAt: 1,
      });
      const projectId = await ctx.db.insert("careerProjects", {
        careerProfileId,
        credentialId: "business-analysis-fundamentals",
        task: "",
        whatIDid: "",
        reflection: "",
        skills: [],
        addReflectionToProof: false,
      });
      const demoDayId = await ctx.db.insert("demoDays", { crewId, at: 1 });
      await ctx.db.insert("presentations", {
        demoDayId,
        projectId,
        careerProfileId,
      });
      await ctx.db.insert("confidence", {
        careerProfileId,
        credentialId: "business-analysis-fundamentals",
        value: 4,
        at: 1,
      });
      await ctx.db.insert("proofLinks", {
        careerProfileId,
        slug: `proof-${careerProfileId}`,
        credentialId: "business-analysis-fundamentals",
      });
    }
    // M2: Dan's proposal, with a crewmate's choice on it, goes with him.
    const proposed = await ctx.db.insert("crewRules", {
      crewId,
      text: "Share one link a week",
      source: "member",
      proposedBy: id,
      status: "proposed",
    });
    await ctx.db.insert("ruleChoices", {
      ruleId: proposed,
      careerProfileId: otherId,
      on: true,
    });
    const userId = (await ctx.db.get(id))!.userId;
    await ctx.db.insert("careerBadges", {
      userId,
      credentialId: "business-analysis-fundamentals",
      earnedAt: 1,
    });
    await ctx.db.insert("endorsements", {
      userId,
      guideId,
      credentialId: "business-analysis-fundamentals",
      text: "Clear thinking",
    });
  });

  // P11: signed out and a guide are refused; nothing changes.
  await expect(
    t.mutation(api.careers.tracks.deleteCareer, {}),
  ).rejects.toMatchObject({ data: { code: "NOT_SIGNED_IN" } });
  await expect(
    t
      .withIdentity({ subject: "user_guide" })
      .mutation(api.careers.tracks.deleteCareer, {}),
  ).rejects.toMatchObject({ data: { code: "NO_CAREER_TRACK" } });

  await dan.mutation(api.careers.tracks.deleteCareer, {});
  const left = await t.run(async (ctx) => {
    const count: Record<string, number> = {};
    for (const table of [
      "careerSettings",
      "crewMembers",
      "crewRules",
      "ruleChoices",
      "protectedHours",
      "lessonProgress",
      "careerProjects",
      "presentations",
      "confidence",
      "proofLinks",
      "careerBadges",
      "endorsements",
    ] as const) {
      count[table] = (await ctx.db.query(table).collect()).length;
    }
    count.careerProfiles = (
      await ctx.db.query("careerProfiles").collect()
    ).length;
    return count;
  });
  // The other learner's rows (and the guide's profile) stay; Dan's badge and endorsement stay.
  expect(left).toEqual({
    careerProfiles: 2,
    careerSettings: 0,
    crewMembers: 1,
    crewRules: 2,
    ruleChoices: 1,
    protectedHours: 1,
    lessonProgress: 1,
    careerProjects: 1,
    presentations: 1,
    confidence: 1,
    proofLinks: 1,
    careerBadges: 1,
    endorsements: 1,
  });
  expect(await dan.query(api.viewer.home, {})).toBe(teamHome);
  expect(await dan.query(api.viewer.shell, {})).toEqual(teamShell);

  // P10: every event so far is counts only.
  const events = await t.run((ctx) => ctx.db.query("careerEvents").collect());
  expect(events.map((e) => e.name)).toEqual([
    "privateTrackStarted",
    "trackDeleted",
  ]);
  for (const e of events) {
    expect(
      Object.keys(e).filter(
        (k) => !["_id", "_creationTime", "name", "at", "partnerId"].includes(k),
      ),
    ).toEqual([]);
  }
});

test("spec 11.1: nothing in convex/careers calls sendEmail", () => {
  const dir = new URL("../../convex/careers/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  expect(files).toContain("tracks.ts");
  for (const file of files) {
    expect(readFileSync(new URL(file, dir), "utf8"), file).not.toMatch(
      /sendEmail/,
    );
  }
});
