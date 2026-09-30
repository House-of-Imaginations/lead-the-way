import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEMO_NOW, mel } from "../../convex/lib/demo/schedule";
import { calderLane, harness, workspace, type T } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const PAGE_1 = {
  sizeBand: "6 to 10",
  industry: "Professional services",
  teamFunction: "Client service",
  aiUse: "Advanced users, inconsistent practices",
  challenges: [],
};

async function teamOf(t: T, orgId: Id<"orgs">) {
  return (await t.run((ctx) =>
    ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
  ))!;
}

async function sprintsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

test("saveProfile saves page 1 as a draft", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.teams.saveProfile, {
    ...PAGE_1,
    finish: false,
    expectOrgId: orgId,
  });
  expect(await priya.query(api.teams.current, {})).toEqual({
    name: "Client Services team",
    ...PAGE_1,
    challengeOther: null,
    saved: false,
    normsConfidence: null,
  });
  expect((await teamOf(t, orgId)).savedAt).toBeUndefined();

  // A field cleared on screen is cleared here.
  await priya.mutation(api.teams.saveProfile, {
    sizeBand: "6 to 10",
    challenges: [],
    finish: false,
    expectOrgId: orgId,
  });
  expect(await priya.query(api.teams.current, {})).toMatchObject({
    sizeBand: "6 to 10",
    industry: null,
    teamFunction: null,
    aiUse: null,
  });
});

test("finish sets savedAt once", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const save = (finish: boolean) =>
    priya.mutation(api.teams.saveProfile, {
      ...PAGE_1,
      challenges: ["Lack of time to learn", "Other", "Lack of time to learn"],
      challengeOther: "  Clients ask what we use  ",
      finish,
      expectOrgId: orgId,
    });
  await save(true);
  const first = await teamOf(t, orgId);
  expect(first).toMatchObject({
    savedAt: DEMO_NOW,
    challenges: ["Lack of time to learn", "Other"],
    challengeOther: "Clients ask what we use",
  });
  await t.mutation(internal.seed.clock, { target: "week1" });
  await save(true);
  await save(false);
  expect((await teamOf(t, orgId)).savedAt).toBe(DEMO_NOW);
  expect((await priya.query(api.teams.current, {}))?.saved).toBe(true);

  // Without "Other", its words are dropped.
  await priya.mutation(api.teams.saveProfile, {
    ...PAGE_1,
    challengeOther: "Clients ask what we use",
    finish: true,
    expectOrgId: orgId,
  });
  expect((await teamOf(t, orgId)).challengeOther).toBeUndefined();
});

test("saveProfile refuses a size band that isn't offered", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const before = await teamOf(t, orgId);
  for (const bad of [
    { sizeBand: "2-5" },
    { industry: "Mining" },
    { teamFunction: "client service" },
    { aiUse: "Little or no use yet" },
    { challenges: ["Too many meetings"] },
    { challenges: ["Other"], challengeOther: "x".repeat(201) },
    { normsConfidence: 0 },
    { normsConfidence: 6 },
    { normsConfidence: 2.5 },
  ]) {
    await expect(
      priya.mutation(api.teams.saveProfile, {
        challenges: [],
        ...bad,
        finish: true,
        expectOrgId: orgId,
      }),
      JSON.stringify(bad),
    ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  }
  expect(await teamOf(t, orgId)).toEqual(before);
});

test("the before rating is upserted on the current sprint", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const save = (normsConfidence?: number) =>
    priya.mutation(api.teams.saveProfile, {
      ...PAGE_1,
      normsConfidence,
      finish: true,
      expectOrgId: orgId,
    });
  await save(2);
  await save(4);
  await save(); // no rating: the last one stands
  expect((await priya.query(api.teams.current, {}))?.normsConfidence).toBe(4);
  const [sprint] = await sprintsOf(t, orgId);
  const rows = await t.run((ctx) =>
    ctx.db
      .query("surveyResponses")
      .withIndex("by_sprint_phase_and_question", (q) =>
        q
          .eq("sprintId", sprint!._id)
          .eq("phase", "before")
          .eq("question", "normsConfidence"),
      )
      .collect(),
  );
  expect(rows.map((r) => r.score)).toEqual([4]);
});

test("a real workspace gets its first sprint on save", async () => {
  vi.setSystemTime(mel("2026-09-01T09:30"));
  const t = harness();
  const { owner, orgId } = await workspace(t);
  expect(await sprintsOf(t, orgId)).toEqual([]);
  expect(await owner.query(api.teams.current, {})).toMatchObject({
    name: "Your team",
    saved: false,
    normsConfidence: null,
  });
  await owner.mutation(api.teams.saveProfile, {
    challenges: [],
    finish: false,
    expectOrgId: orgId,
  });
  await owner.mutation(api.teams.saveProfile, {
    challenges: [],
    normsConfidence: 3,
    finish: true,
    expectOrgId: orgId,
  });
  const sprints = await sprintsOf(t, orgId);
  expect(sprints).toHaveLength(1);
  expect(sprints[0]).toMatchObject({
    status: "draft",
    startDate: "2026-09-09",
    protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
  });
  expect((await owner.query(api.teams.current, {}))?.normsConfidence).toBe(3);
});
