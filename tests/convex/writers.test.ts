import { afterEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { mel } from "../../convex/lib/demo/schedule";
import { logEvent } from "../../convex/lib/events";
import { insertInvite } from "../../convex/lib/orgs/invites";
import { joinByInvite } from "../../convex/lib/orgs/join";
import {
  currentSprint,
  DEFAULT_COURSE,
  ensureSprint,
} from "../../convex/lib/sprint";
import { upsertAnswer } from "../../convex/lib/surveys";
import { getViewer } from "../../convex/lib/viewer";
import { harness, OWNER, workspace, type T } from "./workspace/helpers";

afterEach(() => {
  vi.useRealTimers();
});

async function employeeRole(t: T, orgId: Id<"orgs">) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("orgRoles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).find((r) => r.name === "Employee")!,
  );
}

async function eventsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

test("joinByInvite seats, accepts and logs invite.accepted", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const role = await employeeRole(t, orgId);
  const at = mel("2026-09-08T16:00");
  const { personId, invite } = await t.run(async (ctx) => {
    const { inviteId } = await insertInvite(ctx, {
      orgId,
      roleId: role._id,
      invitedBy: OWNER.subject,
      at,
    });
    const invite = (await ctx.db.get(inviteId))!;
    const personId = await joinByInvite(ctx, invite, "user_bob", at, "Analyst");
    return { personId, invite: (await ctx.db.get(inviteId))! };
  });
  const person = await t.run((ctx) => ctx.db.get(personId));
  expect(person).toMatchObject({
    orgId,
    userId: "user_bob",
    roleId: role._id,
    jobTitle: "Analyst",
  });
  expect(invite).toMatchObject({
    status: "accepted",
    personId,
    respondedAt: at,
  });
  const bob = t.withIdentity({ subject: "user_bob" });
  expect((await bob.query(api.orgs.active, {}))?.org._id).toBe(orgId);
  expect(
    (await eventsOf(t, orgId)).map(({ type, at }) => ({ type, at })),
  ).toEqual([{ type: "invite.accepted", at }]);
});

test("invites.accept logs invite.accepted", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const role = await employeeRole(t, orgId);
  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId: role._id,
  });
  await t.withIdentity({ subject: "bob" }).mutation(api.invites.accept, {
    token,
  });
  expect((await eventsOf(t, orgId)).map((e) => e.type)).toEqual([
    "invite.accepted",
  ]);
});

test("insertInvite lowercases the email", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const role = await employeeRole(t, orgId);
  const before = Date.now();
  const invite = await t.run(async (ctx) => {
    const { inviteId, token, expiresAt } = await insertInvite(ctx, {
      orgId,
      roleId: role._id,
      email: "  Dan.Okafor@Example.COM ",
      name: "Dan Okafor",
      invitedBy: OWNER.subject,
      at: 123,
      sentAt: 123,
    });
    const row = (await ctx.db.get(inviteId))!;
    expect(row.token).toBe(token);
    expect(row.expiresAt).toBe(expiresAt);
    return row;
  });
  expect(invite).toMatchObject({
    email: "dan.okafor@example.com",
    name: "Dan Okafor",
    status: "pending",
    createdAt: 123,
    sentAt: 123,
  });
  expect(invite.expiresAt).toBeGreaterThan(before);
  // A blank address is no address.
  const blank = await t.run(async (ctx) => {
    const { inviteId } = await insertInvite(ctx, {
      orgId,
      roleId: role._id,
      email: "   ",
      invitedBy: OWNER.subject,
      at: 0,
    });
    return (await ctx.db.get(inviteId))!;
  });
  expect(blank.email).toBeUndefined();
});

test("ensureSprint makes one draft and reuses it", async () => {
  vi.setSystemTime(mel("2026-09-01T09:30"));
  const t = harness();
  const { orgId } = await workspace(t);
  const run = () =>
    t.withIdentity(OWNER).run(async (ctx) => {
      const viewer = (await getViewer(ctx))!;
      return await ensureSprint(ctx, viewer);
    });
  const first = await run();
  expect(first).toMatchObject({
    orgId,
    weeks: 4,
    protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
    courseTitle: DEFAULT_COURSE,
    createdAt: mel("2026-09-01T09:30"),
  });
  expect(first.launchedAt).toBeUndefined();
  // Nothing writes `status` (Ruling 11); `sprintPhase` says "draft".
  expect(first.status).toBeUndefined();
  const second = await run();
  expect(second._id).toBe(first._id);
  const all = await t.run((ctx) =>
    ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(all).toHaveLength(1);
});

test("currentSprint returns the newest", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const newest = await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    const row = {
      orgId,
      teamId: team._id,
      status: "draft" as const,
      startDate: "2026-09-09",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: DEFAULT_COURSE,
      createdAt: 0,
    };
    await ctx.db.insert("sprints", row);
    return await ctx.db.insert("sprints", { ...row, startDate: "2026-10-14" });
  });
  expect((await t.run((ctx) => currentSprint(ctx, orgId)))?._id).toBe(newest);
  const other = await workspace(t, "Birch Studio");
  expect(await t.run((ctx) => currentSprint(ctx, other.orgId))).toBeNull();
});

test("logEvent writes the event at the given time", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const at = mel("2026-09-02T11:00");
  await t.run((ctx) =>
    logEvent(ctx, {
      orgId,
      type: "hour.notReady",
      at,
      meta: { reason: "none", choice: "keepExploring" },
    }),
  );
  expect(await eventsOf(t, orgId)).toMatchObject([
    {
      orgId,
      type: "hour.notReady",
      at,
      meta: { reason: "none", choice: "keepExploring" },
    },
  ]);
});

test("upsertAnswer keeps one row per key", async () => {
  vi.setSystemTime(mel("2026-09-01T09:30"));
  const t = harness();
  const { orgId } = await workspace(t);
  const rows = await t.withIdentity(OWNER).run(async (ctx) => {
    const viewer = (await getViewer(ctx))!;
    const sprint = await ensureSprint(ctx, viewer);
    const answer = (
      phase: "before" | "after",
      question: "normsConfidence" | "aiConfidence",
      score: number,
    ) =>
      upsertAnswer(ctx, {
        orgId,
        sprintId: sprint._id,
        personId: viewer.person._id,
        phase,
        question,
        score,
        at: viewer.now,
      });
    await answer("before", "normsConfidence", 2);
    await answer("before", "normsConfidence", 4);
    await answer("before", "normsConfidence", 4);
    await answer("after", "normsConfidence", 5);
    await answer("before", "aiConfidence", 3);
    return await ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", viewer.person._id).eq("sprintId", sprint._id),
      )
      .collect();
  });
  expect(rows.map((r) => [r.phase, r.question, r.score])).toEqual([
    ["before", "normsConfidence", 4],
    ["after", "normsConfidence", 5],
    ["before", "aiConfidence", 3],
  ]);
  expect(await eventsOf(t, orgId)).toEqual([]);
});
