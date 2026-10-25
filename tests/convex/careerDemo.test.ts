import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { isDemoAddress } from "../../convex/lib/demo/cast";
import { CAREER_TARGETS } from "../../convex/lib/demo/pivotCrews";
import { sendEmail, type EmailCtx } from "../../convex/lib/email/send";
import { CAREER_TABLES } from "../../convex/lib/orgs/cascade";
import { isDemoAccount } from "../../convex/lib/orgs/people";
import { getCareer } from "../../convex/lib/viewer";
import { addCareer, calderLane } from "./workspace/helpers";

// P12a Task 2: the careers clock, cast, seed and reset (spec 7, 11.2).

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function careersDemo() {
  const lane = await calderLane();
  await lane.t.mutation(internal.seed.writeCareers, {});
  return lane;
}

const rowCounts = (t: Awaited<ReturnType<typeof careersDemo>>["t"]) =>
  t.run(async (ctx) => {
    const out: Record<string, number> = {};
    for (const table of CAREER_TABLES)
      out[table] = (await ctx.db.query(table).collect()).length;
    return out;
  });

test("the careers reset is idempotent and writes the cast", async () => {
  const { t } = await careersDemo();
  const first = await rowCounts(t);
  const total = Object.values(first).reduce((a, b) => a + b, 0);
  expect(await t.mutation(internal.seed.writeCareers, {})).toBe(total);
  expect(await rowCounts(t)).toEqual(first);
  expect(first).toMatchObject({
    careerPartners: 1,
    careerDemo: 1,
    // Amara, Jordan, Sofia, Tevita, Raj; Lena and Kofi; Kofi's three.
    careerProfiles: 10,
    careerSettings: 8,
    // Amara's, Kofi's and Lena's open one.
    crews: 3,
    crewMembers: 8,
    lessonProgress: 3,
    demoDays: 1,
    careerProjects: 5,
    presentations: 5,
    careerBadges: 0,
  });
});

test("P1: the careers reset leaves a real learner's rows alone", async () => {
  const { t } = await careersDemo();
  const real = await t.run(async (ctx) => {
    const careerProfileId = await ctx.db.insert("careerProfiles", {
      userId: "user_real",
      kind: "learner",
      firstName: "Real",
      private: true,
    });
    return [
      careerProfileId,
      await ctx.db.insert("careerSettings", {
        careerProfileId,
        showDoneToCrew: true,
        guideSeesProgress: true,
        reflectionOnProof: false,
        researchOptIn: false,
        learningHour: true,
        crewCheckIn: true,
        missedWeekNudge: true,
        sundaySummary: true,
        listenInstead: false,
      }),
      await ctx.db.insert("careerBadges", {
        userId: "user_real",
        credentialId: "data-fundamentals",
        earnedAt: 1,
      }),
      await ctx.db.insert("proofLinks", {
        careerProfileId,
        slug: "real-proof",
        credentialId: "data-fundamentals",
      }),
    ] as const;
  });
  await t.mutation(internal.seed.writeCareers, {});
  const left = await t.run((ctx) =>
    Promise.all(real.map((id) => ctx.db.get(id))),
  );
  expect(left.every(Boolean)).toBe(true);
});

test("the careers clock starts at week1, moves forward only and plays each step once", async () => {
  const { as } = await careersDemo();
  const amara = as("amara");
  const now = () => amara.run(async (ctx) => (await getCareer(ctx))!.now);
  expect(await now()).toBe(CAREER_TARGETS.week1);

  await amara.mutation(api.demo.moveCareerClock, { target: "week2" });
  expect(await now()).toBe(CAREER_TARGETS.week2);
  const lessons = () =>
    amara.run(async (ctx) => {
      const career = (await getCareer(ctx))!;
      return (
        await ctx.db
          .query("lessonProgress")
          .withIndex("by_careerProfile", (q) =>
            q.eq("careerProfileId", career.profile._id),
          )
          .collect()
      ).length;
    });
  expect(await lessons()).toBe(4);

  await expect(
    amara.mutation(api.demo.moveCareerClock, { target: "week1" }),
  ).rejects.toMatchObject({ data: { code: "DEMO_CLOCK_BACKWARDS" } });
  // The same target again is not backwards, and plays nothing twice.
  await amara.mutation(api.demo.moveCareerClock, { target: "week2" });
  expect(await lessons()).toBe(4);

  // Dan, a team demo account, may move it too; the jump plays week3 and proof.
  await as("dan").mutation(api.demo.moveCareerClock, { target: "proof" });
  expect(await lessons()).toBe(11);

  const flagged = await amara.mutation(api.demo.moveCareerClock, {
    target: "missedWeek",
  });
  expect(flagged).toEqual({ now: CAREER_TARGETS.proof, missedWeek: true });
  expect(
    await amara.run(async (ctx) => (await getCareer(ctx))!.missedWeek),
  ).toBe(true);
});

test("the proof step earns the badge and Lena's endorsement", async () => {
  const { t, as } = await careersDemo();
  await as("amara").mutation(api.demo.moveCareerClock, { target: "proof" });
  const rows = await t.run(async (ctx) => ({
    badges: await ctx.db.query("careerBadges").collect(),
    endorsements: await ctx.db.query("endorsements").collect(),
  }));
  expect(rows.badges).toHaveLength(1);
  expect(rows.badges[0]).toMatchObject({ credentialId: "data-fundamentals" });
  expect(rows.endorsements).toHaveLength(1);
});

test("the careers clock needs DEMO_MODE and a demo account", async () => {
  const { t, as } = await careersDemo();
  const stranger = t.withIdentity({ subject: "user_stranger" });
  await expect(
    stranger.mutation(api.demo.moveCareerClock, { target: "week2" }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(await stranger.query(api.demo.careerStatus, {})).toBeNull();

  expect(await as("amara").query(api.demo.careerStatus, {})).toEqual({
    now: CAREER_TARGETS.week1,
    missedWeek: false,
    counts: [],
  });

  vi.stubEnv("DEMO_MODE", "");
  await expect(
    as("amara").mutation(api.demo.moveCareerClock, { target: "week2" }),
  ).rejects.toMatchObject({ data: { code: "FEATURE_UNAVAILABLE" } });
  expect(await as("amara").query(api.demo.careerStatus, {})).toBeNull();
  // Outside the demo, a career reads real time.
  const before = Date.now();
  const now = await as("amara").run(async (ctx) => (await getCareer(ctx))!.now);
  expect(now).toBeGreaterThanOrEqual(before);
});

test("careerStatus counts careerEvents by name", async () => {
  const { t, as } = await careersDemo();
  await t.run(async (ctx) => {
    for (const name of ["map.made", "map.made", "crew.joined"])
      await ctx.db.insert("careerEvents", { name, at: CAREER_TARGETS.week1 });
  });
  expect((await as("lena").query(api.demo.careerStatus, {}))?.counts).toEqual([
    { name: "crew.joined", count: 1 },
    { name: "map.made", count: 2 },
  ]);
});

test("Dan is team-only after either reset", async () => {
  const { t, orgId, as } = await careersDemo();
  const dan = as("dan");
  const hasCareer = () =>
    dan.run(async (ctx) => (await getCareer(ctx)) !== null);

  await addCareer(dan);
  expect(await hasCareer()).toBe(true);
  await t.mutation(internal.seed.writeCareers, {});
  expect(await hasCareer()).toBe(false);

  // The guide's reset rewrites both tracks (spec 11.2).
  await addCareer(dan);
  await as("priya").mutation(api.demo.reset, { expectOrgId: orgId });
  expect(await hasCareer()).toBe(false);
  expect(
    await as("amara").run(async (ctx) => (await getCareer(ctx))?.now),
  ).toBe(CAREER_TARGETS.week1);
});

test("both demo domains are behind the mail gate and the account lock", async () => {
  const { as } = await careersDemo();
  for (const email of [
    "dan.okafor@calderlane.com.au",
    "Amara@PivotCrews.example.",
    "dan@pivotcrews.example",
  ]) {
    expect(isDemoAddress(email)).toBe(true);
    await expect(
      sendEmail({} as EmailCtx, email, "Hello", {
        heading: "Hello",
        paragraphs: [],
      }),
    ).resolves.toBe(false);
  }
  expect(isDemoAddress("amara@pivotcrews.example.com")).toBe(false);
  expect(isDemoAddress("amara@notpivotcrews.example")).toBe(false);
  // The lock reads the account's own address.
  for (const key of ["amara", "lena", "kofi"]) {
    expect(
      await as(key).run(async (ctx) =>
        isDemoAccount(ctx, (await ctx.auth.getUserIdentity())!.subject),
      ),
    ).toBe(true);
  }
});
