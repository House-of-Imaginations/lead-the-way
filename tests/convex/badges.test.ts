import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf, type CastKey } from "../../convex/lib/demo/cast";
import type { DemoTarget } from "../../convex/lib/demo/schedule";
import { calderLane, type T } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const move = (t: T, target: DemoTarget) =>
  t.mutation(internal.seed.clock, { target });

async function personOf(t: T, orgId: Id<"orgs">, key: CastKey) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

async function projectOf(t: T, personId: Id<"people">) {
  return await t.run(
    async (ctx) =>
      (await ctx.db
        .query("projects")
        .withIndex("by_person_and_sprint", (q) => q.eq("personId", personId))
        .unique())!,
  );
}

async function badgeOf(t: T, personId: Id<"people">) {
  return await t.run(
    async (ctx) =>
      (await ctx.db
        .query("badges")
        .withIndex("by_person", (q) => q.eq("personId", personId))
        .unique())!,
  );
}

const SLUG = "dan-okafor-ai-fundamentals";
const BADGE = {
  name: "AI Fundamentals",
  issuer: "IBM SkillsBuild",
  completed: "Completed 24 September 2026",
  skills: [
    "AI prompting",
    "Critical evaluation",
    "Responsible AI",
    "Workflow improvement",
  ],
};
const REFLECTION = {
  project: "AI-assisted weekly client reporting",
  // Spec 3.3: on 15, "Application" is the project headline.
  application: "40 minutes saved per week",
  shared: "Shared at show and tell, 30 Sep",
};

test("badges: mine, attachReflection and publicBySlug", async () => {
  const { t, orgId } = await calderLane();
  await move(t, "complete");
  // Signed out: `t` itself, no identity.
  const read = () => t.query(api.badges.publicBySlug, { slug: SLUG });

  // toEqual, not toMatchObject: no course progress, time, score or
  // screenshot can ride along unnoticed.
  expect(await read()).toEqual({
    ...BADGE,
    holder: "Dan Okafor",
    reflection: REFLECTION,
  });

  const dan = await personOf(t, orgId, "dan");
  const badge = await badgeOf(t, dan);
  const own = await projectOf(t, dan);

  // Dan turns "Reflections on my credential" off.
  const settingsId = await t.run((ctx) =>
    ctx.db.insert("settings", {
      orgId,
      personId: dan,
      weeklyReminder: true,
      showAndTellReminder: true,
      askBeforeSharing: true,
      reflectionsOnCredential: false,
      includeInTeamTotals: true,
      captionsByDefault: true,
      reduceMotion: false,
    }),
  );
  expect(await read()).toEqual({
    ...BADGE,
    holder: "Dan Okafor",
    reflection: null,
  });
  await t.run((ctx) => ctx.db.delete(settingsId));
  expect((await read())!.reflection).toEqual(REFLECTION);

  // Linked to somebody else's project: not his to show.
  const mei = await projectOf(t, await personOf(t, orgId, "mei"));
  await t.run((ctx) =>
    ctx.db.patch(badge._id, { reflectionProjectId: mei._id }),
  );
  expect((await read())!.reflection).toBeNull();

  // His own project, but not saved.
  await t.run(async (ctx) => {
    await ctx.db.patch(badge._id, { reflectionProjectId: own._id });
    await ctx.db.patch(own._id, { status: "draft" });
  });
  expect((await read())!.reflection).toBeNull();

  // Not linked at all.
  await t.run(async (ctx) => {
    await ctx.db.patch(own._id, { status: "saved" });
    await ctx.db.patch(badge._id, { reflectionProjectId: undefined });
  });
  expect((await read())!.reflection).toBeNull();

  // A slug nobody holds is a 404 on the page.
  expect(
    await t.query(api.badges.publicBySlug, { slug: "nobody-ai-fundamentals" }),
  ).toBeNull();
});

test("mine is null until the badge, then is the viewer's own credential", async () => {
  const { t, as } = await calderLane();
  await move(t, "week3");
  expect(await as("dan").query(api.badges.mine, {})).toBeNull();

  await move(t, "complete");
  expect(await as("dan").query(api.badges.mine, {})).toEqual({
    ...BADGE,
    slug: SLUG,
    reflection: REFLECTION,
  });
  expect(await as("priya").query(api.badges.mine, {})).toBeNull();
});

test("attachReflection links the viewer's saved project to their badge", async () => {
  const { t, orgId, as } = await calderLane();
  // Badge on the 24th, project saved on the 29th, nothing linked or presented yet.
  await move(t, "week4");
  const dan = as("dan");
  const expectOrgId = orgId;
  expect((await dan.query(api.badges.mine, {}))!.reflection).toBeNull();

  await dan.mutation(api.badges.attachReflection, { expectOrgId });
  expect((await dan.query(api.badges.mine, {}))!.reflection).toEqual({
    project: "AI-assisted weekly client reporting",
    application: "40 minutes saved per week",
    shared: null,
  });

  // Mei has a saved project but no badge.
  await expect(
    as("mei").mutation(api.badges.attachReflection, { expectOrgId }),
  ).rejects.toMatchObject({ data: { code: "BADGE_MISSING" } });

  // Dan's project back to a draft: nothing saved to link.
  const own = await projectOf(t, await personOf(t, orgId, "dan"));
  await t.run((ctx) => ctx.db.patch(own._id, { status: "draft" }));
  await expect(
    dan.mutation(api.badges.attachReflection, { expectOrgId }),
  ).rejects.toMatchObject({ data: { code: "PROJECT_NOT_SAVED" } });
});
