import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { castOf } from "../../convex/lib/demo/cast";
import { calderLane } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const SLUG = "dan-okafor-ai-fundamentals";
const SENTINEL = 4242;

test("publicBySlug shows the reflection only when linked and allowed", async () => {
  const { t, orgId } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "complete" });
  const ids = await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const personOf = (key: "dan" | "mei") =>
      people.find((p) => p.email === castOf(key).email)!;
    const projectOf = async (key: "dan" | "mei") =>
      (await ctx.db
        .query("projects")
        .withIndex("by_person_and_sprint", (q) =>
          q.eq("personId", personOf(key)._id),
        )
        .unique())!;
    const dan = personOf("dan");
    // Dan's course progress: nothing on the credential may carry it.
    const progress = (await ctx.db
      .query("learningProgress")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", dan._id))
      .unique())!;
    await ctx.db.patch(progress._id, {
      sessionsDone: SENTINEL,
      percent: SENTINEL,
    });
    const badge = (await ctx.db
      .query("badges")
      .withIndex("by_person", (q) => q.eq("personId", dan._id))
      .unique())!;
    const danProject = await projectOf("dan");
    // The complete steps linked it (dan.reflection), so the first read shows it.
    expect(badge.reflectionProjectId).toBe(danProject._id);
    return {
      danId: dan._id,
      badgeId: badge._id,
      danProject: danProject._id,
      meiProject: (await projectOf("mei"))._id,
    };
  });
  // `t` has no identity: this is the signed-out read the public page makes.
  const read = () => t.query(api.badges.publicBySlug, { slug: SLUG });

  const shown = await read();
  // Exactly these fields: never course progress, time, scores, the slug or a screenshot.
  expect(Object.keys(shown ?? {}).sort()).toEqual([
    "completed",
    "holder",
    "issuer",
    "name",
    "reflection",
    "skills",
  ]);
  expect(shown).toMatchObject({
    name: "AI Fundamentals",
    issuer: "IBM SkillsBuild",
    completed: "Completed 24 September 2026",
    holder: "Dan Okafor",
    skills: [
      "AI prompting",
      "Critical evaluation",
      "Responsible AI",
      "Workflow improvement",
    ],
    reflection: {
      project: "AI-assisted weekly client reporting",
      shared: "Shared at show and tell, 30 Sep",
    },
  });
  expect(Object.keys(shown!.reflection!).sort()).toEqual([
    "application",
    "project",
    "shared",
  ]);
  expect(JSON.stringify(shown)).not.toMatch(/(?<![\d.])4242(?!\d)/);

  // Dan turns "reflections on credential" off: the badge stays, the reflection goes.
  const settingsId = await t.run((ctx) =>
    ctx.db.insert("settings", {
      orgId,
      personId: ids.danId,
      weeklyReminder: true,
      showAndTellReminder: true,
      askBeforeSharing: true,
      reflectionsOnCredential: false,
      includeInTeamTotals: true,
      captionsByDefault: true,
      reduceMotion: false,
    }),
  );
  expect(await read()).toMatchObject({
    name: "AI Fundamentals",
    holder: "Dan Okafor",
    reflection: null,
  });
  await t.run((ctx) => ctx.db.delete(settingsId));
  expect((await read())?.reflection).not.toBeNull();

  // Not linked.
  await t.run((ctx) =>
    ctx.db.patch(ids.badgeId, { reflectionProjectId: undefined }),
  );
  expect((await read())?.reflection).toBeNull();

  // Linked to someone else's saved project.
  await t.run((ctx) =>
    ctx.db.patch(ids.badgeId, { reflectionProjectId: ids.meiProject }),
  );
  expect((await read())?.reflection).toBeNull();

  // Linked to Dan's own project while it is a draft.
  await t.run(async (ctx) => {
    await ctx.db.patch(ids.badgeId, { reflectionProjectId: ids.danProject });
    await ctx.db.patch(ids.danProject, { status: "draft" });
  });
  expect((await read())?.reflection).toBeNull();

  // An unknown slug.
  expect(
    await t.query(api.badges.publicBySlug, { slug: "nobody-ai-fundamentals" }),
  ).toBeNull();
});
