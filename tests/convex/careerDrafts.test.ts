import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { seedAuthUser } from "./testHelpers";
import { addCareer, harness, type T } from "./workspace/helpers";

afterEach(() => {
  vi.useRealTimers();
});

const ANSWERS = {
  currentRole: "Account Executive" as const,
  targetRole: "business-analyst" as const,
  hoursPerWeek: 2 as const,
  consent: true,
};

async function draft(t: T, extra: { partner?: string } = {}) {
  return await t.mutation(api.careers.drafts.saveAnswers, {
    ...ANSWERS,
    ...extra,
  });
}

test("P9: a draft is read only with its token and holds no name or email", async () => {
  const t = harness();
  const token = await draft(t);
  expect(token.length).toBeGreaterThan(30);
  expect(await t.query(api.careers.drafts.get, { token })).toEqual({
    currentRole: "Account Executive",
    targetRole: "business-analyst",
    hoursPerWeek: 2,
  });
  // P11: no identity opens a draft without its token.
  const other = t.withIdentity({ subject: "user_other" });
  await addCareer(other);
  const guide = t.withIdentity({ subject: "user_guide" });
  await addCareer(guide, "guide");
  for (const caller of [t, other, guide]) {
    expect(
      await caller.query(api.careers.drafts.get, { token: "not-it" }),
    ).toBeNull();
    expect(
      await caller.query(api.careers.drafts.pivotMap, { token: "not-it" }),
    ).toBeNull();
    await caller.mutation(api.careers.drafts.setHours, {
      token: "not-it",
      hoursPerWeek: 3,
    });
  }
  const rows = await t.run((ctx) => ctx.db.query("mapDrafts").collect());
  expect(rows).toHaveLength(1);
  expect(Object.keys(rows[0]!).sort()).toEqual([
    "_creationTime",
    "_id",
    "consentAt",
    "createdAt",
    "currentRole",
    "hoursPerWeek",
    "targetRole",
    "token",
  ]);
  expect(rows[0]!.hoursPerWeek).toBe(2);
});

test("saveAnswers updates the draft its token names and refuses no consent", async () => {
  const t = harness();
  const token = await draft(t);
  expect(
    await t.mutation(api.careers.drafts.saveAnswers, {
      ...ANSWERS,
      token,
      targetRole: "data-analyst",
    }),
  ).toBe(token);
  expect((await t.query(api.careers.drafts.get, { token }))?.targetRole).toBe(
    "data-analyst",
  );
  await expect(
    t.mutation(api.careers.drafts.saveAnswers, { ...ANSWERS, consent: false }),
  ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
});

test("pivotMap: strengths, three skills and weeks from the hours", async () => {
  const t = harness();
  const token = await draft(t);
  const map = await t.query(api.careers.drafts.pivotMap, { token });
  expect(map?.target).toEqual({
    id: "business-analyst",
    name: "Business Analyst",
  });
  expect(map?.strengths).toContain("Client relationships");
  expect(map?.skills).toHaveLength(3);
  expect(map?.weeks).toEqual({ total: 9, perCredential: 3 });
  await t.mutation(api.careers.drafts.setHours, { token, hoursPerWeek: 3 });
  expect(
    (await t.query(api.careers.drafts.pivotMap, { token }))?.weeks,
  ).toEqual({ total: 6, perCredential: 2 });
});

test("P10: a partner's map logs an event with no person in it", async () => {
  const t = harness();
  const partnerId = await t.run((ctx) =>
    ctx.db.insert("careerPartners", {
      slug: "footscray-library",
      name: "Footscray Library",
      kind: "library",
    }),
  );
  await draft(t, { partner: "footscray-library" });
  const events = await t.run((ctx) => ctx.db.query("careerEvents").collect());
  expect(events.map(({ name, partnerId: p }) => ({ name, p }))).toEqual([
    { name: "mapBuilt", p: partnerId },
  ]);
  expect(Object.keys(events[0]!).sort()).toEqual([
    "_creationTime",
    "_id",
    "at",
    "name",
    "partnerId",
  ]);
});

test("H1: a burst of new drafts is refused after 60, and updating one stays free", async () => {
  const t = harness();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
  let token = "";
  for (let i = 0; i < 60; i++) token = await draft(t);
  await expect(draft(t)).rejects.toMatchObject({
    data: { code: "RATE_LIMITED" },
  });
  expect(
    await t.mutation(api.careers.drafts.saveAnswers, { ...ANSWERS, token }),
  ).toBe(token);
});

test("P9: the daily expiry deletes drafts older than 30 days", async () => {
  const t = harness();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
  const old = await draft(t);
  vi.setSystemTime(new Date("2026-11-20T00:00:00Z"));
  const fresh = await draft(t);
  vi.setSystemTime(new Date("2026-12-02T00:00:00Z"));
  await t.mutation(internal.careers.drafts.expire, {});
  expect(await t.query(api.careers.drafts.get, { token: old })).toBeNull();
  expect(
    await t.query(api.careers.drafts.get, { token: fresh }),
  ).not.toBeNull();
});

test("onboarding.start claims the draft into a career profile and deletes it", async () => {
  const t = harness();
  const token = await draft(t);
  const pat = t.withIdentity(
    await seedAuthUser(t, {
      name: "Pat Lee",
      email: "pat@home.example",
      emailVerified: true,
    }),
  );
  expect(
    await pat.mutation(api.onboarding.start, {
      acceptTerms: true,
      track: "career",
      draftToken: token,
    }),
  ).toBe("/home");
  expect(await t.query(api.careers.drafts.get, { token })).toBeNull();
  const { profile, settings } = await t.run(async (ctx) => {
    const profile = (await ctx.db.query("careerProfiles").unique())!;
    const settings = await ctx.db.query("careerSettings").unique();
    return { profile, settings };
  });
  expect(profile).toMatchObject({
    kind: "learner",
    firstName: "Pat",
    currentRole: "Account Executive",
    targetRole: "business-analyst",
    hoursPerWeek: 2,
    private: false,
  });
  expect(profile.contactEmail).toBeUndefined();
  expect(settings).toMatchObject({
    careerProfileId: profile._id,
    showDoneToCrew: true,
    guideSeesProgress: true,
    reflectionOnProof: true,
    researchOptIn: false,
    sundaySummary: false,
  });
  expect(await pat.query(api.viewer.home, {})).toBe("/careers/journey");
  // A claimed token makes nothing a second time.
  await pat.mutation(api.onboarding.start, {
    acceptTerms: true,
    track: "career",
    draftToken: token,
  });
  expect(
    await t.run(
      async (ctx) => (await ctx.db.query("careerProfiles").collect()).length,
    ),
  ).toBe(1);
  // No workspace was made for a career sign-up.
  expect(await t.run((ctx) => ctx.db.query("orgs").collect())).toEqual([]);
});
