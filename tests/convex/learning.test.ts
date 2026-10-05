import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf } from "../../convex/lib/demo/cast";
import { mel } from "../../convex/lib/demo/schedule";
import {
  calderLane,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Launched on 8 September, week one on Wednesday the 9th. */
async function launchedSprint(t: T, orgId: Id<"orgs">) {
  await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.insert("sprints", {
      orgId,
      teamId: team._id,
      startDate: "2026-09-09",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: "AI Productivity Fundamentals",
      launchedAt: mel("2026-09-08T10:00"),
      createdAt: mel("2026-09-01T09:30"),
    });
  });
}

test("Continue learning marks this week's session, never lowers, and keeps one row", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week2" });
  const dan = as("dan");
  // The script left Dan at 1 session, 60%. Two sessions is 50%: 60 stays.
  const pressed = { sessionsDone: 2, percent: 60, badgeIssued: false };
  expect(
    await dan.mutation(api.learning.continueSession, { expectOrgId: orgId }),
  ).toEqual(pressed);
  expect(
    await dan.mutation(api.learning.continueSession, { expectOrgId: orgId }),
  ).toEqual(pressed);
  const rows = await t.run(async (ctx) => {
    const danId = (await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect()).find((p) => p.email === castOf("dan").email)!._id;
    return await ctx.db
      .query("learningProgress")
      .withIndex("by_person_and_sprint", (q) => q.eq("personId", danId))
      .collect();
  });
  expect(rows).toHaveLength(1);
  expect(await dan.query(api.me.sprint, {})).toMatchObject({
    intro: "9 to 30 September 2026. Three of eight activities done.",
    done: 3,
  });
});

test("the fourth session issues the badge, once", async () => {
  vi.setSystemTime(mel("2026-09-30T14:30"));
  const t = harness();
  const { orgId } = await workspace(t);
  await launchedSprint(t, orgId);
  const { as, personId } = await seat(t, orgId, "user_dan", []);
  const finished = { sessionsDone: 4, percent: 100, badgeIssued: true };
  expect(
    await as.mutation(api.learning.continueSession, { expectOrgId: orgId }),
  ).toEqual(finished);
  // The second press adds nothing and says so.
  expect(
    await as.mutation(api.learning.continueSession, { expectOrgId: orgId }),
  ).toEqual({ ...finished, badgeIssued: false });
  const badges = await t.run((ctx) =>
    ctx.db
      .query("badges")
      .withIndex("by_person", (q) => q.eq("personId", personId))
      .collect(),
  );
  expect(badges.map((b) => b.name)).toEqual(["AI Fundamentals"]);
});

test("a row ahead of the clock keeps its sessions", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week2" });
  await t.run(async (ctx) => {
    const row = (await ctx.db.query("learningProgress").collect())[0]!;
    await ctx.db.patch(row._id, { sessionsDone: 3, percent: 75 });
  });
  expect(
    await as("dan").mutation(api.learning.continueSession, {
      expectOrgId: orgId,
    }),
  ).toEqual({ sessionsDone: 3, percent: 75, badgeIssued: false });
});

test("a week 3 press issues no badge", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week3" });
  await as("dan").mutation(api.learning.continueSession, {
    expectOrgId: orgId,
  });
  expect(await t.run((ctx) => ctx.db.query("badges").collect())).toHaveLength(0);
});

test("before week one, Continue learning opens session 1", async () => {
  vi.setSystemTime(mel("2026-09-01T09:30"));
  const t = harness();
  const { orgId } = await workspace(t);
  await launchedSprint(t, orgId);
  const { as } = await seat(t, orgId, "user_e", []);
  expect(
    await as.mutation(api.learning.continueSession, { expectOrgId: orgId }),
  ).toEqual({ sessionsDone: 1, percent: 25, badgeIssued: false });
});

test("without a launched sprint there is nothing to continue", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as } = await seat(t, orgId, "user_e", []);
  await expect(
    as.mutation(api.learning.continueSession, { expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "NO_SPRINT" } });
});
