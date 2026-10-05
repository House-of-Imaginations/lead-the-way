import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { mel } from "../../convex/lib/demo/schedule";
import { move } from "./sprintHelpers";
import {
  calderLane,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

/**
 * The reminder sender (S-d). Email stays unconfigured (RESEND_FROM empty),
 * so `sendEmail` returns false and nothing reaches the network guard; the
 * ledger row says what the run decided.
 */
beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/**
 * A real workspace: the owner and two members, A and B, and a sprint launched
 * with Wednesday 2:00 PM hours from 9 September, Melbourne.
 */
async function team(t: T) {
  const { owner, orgId } = await workspace(t);
  const a = await seat(t, orgId, "user_a", []);
  const b = await seat(t, orgId, "user_b", []);
  const sprintId = await t.run(async (ctx) => {
    const teamRow = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    return await ctx.db.insert("sprints", {
      orgId,
      teamId: teamRow._id,
      startDate: "2026-09-09",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      committedAt: 1,
      courseTitle: "AI Productivity Fundamentals",
      launchedAt: mel("2026-09-01T09:00"),
      createdAt: 1,
    });
  });
  return { owner, orgId, a, b, sprintId };
}

/** The ledger, as who got which kind in which week. */
async function sent(t: T, orgId: Id<"orgs">) {
  const rows = await t.run((ctx) =>
    ctx.db
      .query("reminders")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  return rows
    .map((r) => ({
      personId: r.personId,
      week: r.week,
      kind: r.kind,
      emailed: r.emailed,
    }))
    .sort((x, y) => x.personId.localeCompare(y.personId));
}

async function ownerId(t: T, orgId: Id<"orgs">) {
  return await t.run(
    async (ctx) =>
      (
        await ctx.db
          .query("people")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).find((p) => p.userId === "user_owner")!._id,
  );
}

test("the day before the hour, each seated person with the reminder on gets one, once", async () => {
  vi.setSystemTime(mel("2026-09-15T14:00"));
  const t = harness();
  const { orgId, a, b, sprintId } = await team(t);
  await b.as.mutation(api.settings.setToggle, {
    key: "weeklyReminder",
    on: false,
    expectOrgId: orgId,
  });
  const owner = await ownerId(t, orgId);
  const run = () =>
    t.mutation(internal.reminders.send, { orgId, sprintId, week: 2 });
  await run();
  await run();
  // The owner is seated too (Ruling 17); B turned it off.
  expect(await sent(t, orgId)).toEqual(
    [
      { personId: owner, week: 2, kind: "weekly", emailed: false },
      { personId: a.personId, week: 2, kind: "weekly", emailed: false },
    ].sort((x, y) => x.personId.localeCompare(y.personId)),
  );
});

test("the last week sends the show and tell reminder, else the weekly one, never both", async () => {
  vi.setSystemTime(mel("2026-09-29T14:00"));
  const t = harness();
  const { orgId, a, b, sprintId } = await team(t);
  const off = (who: typeof a, key: "weeklyReminder" | "showAndTellReminder") =>
    who.as.mutation(api.settings.setToggle, {
      key,
      on: false,
      expectOrgId: orgId,
    });
  await off(a, "showAndTellReminder");
  await off(b, "showAndTellReminder");
  await off(b, "weeklyReminder");
  const owner = await ownerId(t, orgId);
  await t.mutation(internal.reminders.send, { orgId, sprintId, week: 4 });
  expect(await sent(t, orgId)).toEqual(
    [
      { personId: owner, week: 4, kind: "showAndTell", emailed: false },
      { personId: a.personId, week: 4, kind: "weekly", emailed: false },
    ].sort((x, y) => x.personId.localeCompare(y.personId)),
  );
});

test("nothing for a sprint that never launched, such as a clone still a draft", async () => {
  vi.setSystemTime(mel("2026-09-15T14:00"));
  const t = harness();
  const { orgId, sprintId } = await team(t);
  await t.run((ctx) => ctx.db.patch(sprintId, { launchedAt: undefined }));
  await t.mutation(internal.reminders.send, { orgId, sprintId, week: 2 });
  expect(await sent(t, orgId)).toEqual([]);
});

test("nothing once the hour has begun, for a gone sprint, or another workspace's sprint", async () => {
  vi.setSystemTime(mel("2026-09-16T14:00"));
  const t = harness();
  const { orgId, sprintId } = await team(t);
  // Week 2's hour starts now.
  await t.mutation(internal.reminders.send, { orgId, sprintId, week: 2 });
  expect(await sent(t, orgId)).toEqual([]);

  // Another workspace naming this sprint.
  const other = await t
    .withIdentity({ subject: "user_other" })
    .mutation(api.orgs.create, { name: "Other Co" });
  await t.mutation(internal.reminders.send, {
    orgId: other.orgId,
    sprintId,
    week: 3,
  });
  expect(await sent(t, other.orgId)).toEqual([]);

  // A gone sprint.
  await t.run((ctx) => ctx.db.delete(sprintId));
  await t.mutation(internal.reminders.send, { orgId, sprintId, week: 3 });
  expect(await sent(t, orgId)).toEqual([]);
});

test("never the demo workspace", async () => {
  const { t, orgId } = await calderLane();
  // Week one's clock is before week 2's hour, so only the demo check stops it.
  await move(t, "week1");
  const sprintId = await t.run(
    async (ctx) =>
      (await ctx.db
        .query("sprints")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first())!._id,
  );
  await t.mutation(internal.reminders.send, { orgId, sprintId, week: 2 });
  expect(await sent(t, orgId)).toEqual([]);
});

test("a person who left gets nothing", async () => {
  vi.setSystemTime(mel("2026-09-22T14:00"));
  const t = harness();
  const { orgId, a, b, sprintId } = await team(t);
  await t.run((ctx) => ctx.db.delete(a.personId));
  await t.mutation(internal.reminders.send, { orgId, sprintId, week: 3 });
  const people = (await sent(t, orgId)).map((r) => r.personId);
  expect(people).not.toContain(a.personId);
  expect(people).toContain(b.personId);
});
