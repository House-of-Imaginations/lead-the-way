import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf } from "../../convex/lib/demo/cast";
import { INVITE_MESSAGE } from "../../convex/lib/demo/script";
import { seedAuthUser } from "./testHelpers";
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
  vi.unstubAllEnvs();
});

const OMAR = castOf("omar").email;

/** 09's facts for Calder Lane: Priya's sprint, Wednesdays 2:00 to 3:00 PM from 9 September. */
const CALDER_JOIN = {
  managerName: "Priya Raman",
  managerFirstName: "Priya",
  managerInitials: "PR",
  managerRole: "Team manager",
  quote: INVITE_MESSAGE,
  hour: "Wednesday, 2:00 to 3:00 PM",
  span: "9 to 30 September 2026",
  showAndTell: "30 Sep",
  course: "AI Productivity Fundamentals",
  askBefore: true,
};

async function pendingToken(t: T, orgId: Id<"orgs">, email: string) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) =>
        q.eq("orgId", orgId).eq("status", "pending"),
      )
      .collect();
    return rows.find((i) => i.email === email)!.token;
  });
}

test("the signed-out preview carries 09's facts and the pinned address", async () => {
  const { t, orgId } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week1" });
  const token = await pendingToken(t, orgId, OMAR);

  expect(await t.query(api.invites.publicPreview, { token })).toMatchObject({
    orgName: "Calder Lane",
    emailPinned: true,
    invitedBy: "Priya Raman",
    email: OMAR,
    join: CALDER_JOIN,
  });
});

test("a wrong account still sees the facts the signed-out page shows", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week1" });
  const token = await pendingToken(t, orgId, OMAR);

  // Omar's link, opened by Dan: the wrong account still sees what it was for.
  expect(await as("dan").query(api.invites.preview, { token })).toMatchObject({
    orgName: "Calder Lane",
    acceptState: "WRONG_ACCOUNT",
    join: CALDER_JOIN,
  });
});

test("a withdrawn, declined or used link shows no join facts, even signed in", async () => {
  const { t, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week1" });
  for (const [status, acceptState] of [
    ["revoked", "REVOKED"],
    ["declined", "DECLINED"],
    ["accepted", "USED"],
  ] as const) {
    const token = await t.mutation(internal.seed.invite, { status });
    expect(await as("dan").query(api.invites.preview, { token })).toMatchObject(
      { acceptState, join: null },
    );
  }
});

test("a workspace with no sprint previews without join facts", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  // As workspace/invites.test.ts makes its role.
  const roleId = await t.run((ctx) =>
    ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Member",
      permissions: ["members:read"],
      createdAt: Date.now(),
    }),
  );
  const pinned = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: "bob@example.com",
  });
  const open = await owner.mutation(api.invites.create, { orgId, roleId });

  expect(
    await t.query(api.invites.publicPreview, { token: pinned.token }),
  ).toMatchObject({ email: "bob@example.com", join: null });
  expect(
    await t.query(api.invites.publicPreview, { token: open.token }),
  ).toMatchObject({ email: null, join: null });
  const bob = await seedAuthUser(t, {
    name: "Bob",
    email: "bob@example.com",
    emailVerified: true,
  });
  expect(
    await t
      .withIdentity({ subject: bob.subject })
      .query(api.invites.preview, { token: pinned.token }),
  ).toMatchObject({ acceptState: "READY", join: null });
});

test("teamPreview shows a manager 09 from their own draft sprint", async () => {
  const { t, orgId, as } = await calderLane();
  // Setup, 1 September: a draft sprint. A draft's week one is worked out
  // from the clock, so it still starts on the 9th.
  expect(await as("priya").query(api.invites.teamPreview, {})).toMatchObject({
    orgName: "Calder Lane",
    join: {
      managerName: "Priya Raman",
      hour: "Wednesday, 2:00 to 3:00 PM",
      span: "9 to 30 September 2026",
      showAndTell: "30 Sep",
    },
  });

  await t.mutation(internal.seed.clock, { target: "week1" });
  expect(
    (await as("priya").query(api.invites.teamPreview, { hour: 1 }))?.join,
  ).toEqual(CALDER_JOIN);

  await expect(
    as("dan").query(api.invites.teamPreview, {}),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
  await expect(lead.query(api.invites.teamPreview, {})).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });
});

test("seed:invite hands e2e a Calder Lane link from Priya", async () => {
  const { t } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week1" });
  const token = await t.mutation(internal.seed.invite, {
    email: "Ola@Example.com",
  });
  expect(await t.query(api.invites.publicPreview, { token })).toMatchObject({
    orgName: "Calder Lane",
    email: "ola@example.com",
    join: CALDER_JOIN,
  });

  const revoked = await t.mutation(internal.seed.invite, {
    status: "revoked",
  });
  expect(
    await t.query(api.invites.publicPreview, { token: revoked }),
  ).toBeNull();

  vi.stubEnv("DEMO_MODE", "");
  await expect(t.mutation(internal.seed.invite, {})).rejects.toMatchObject({
    data: { code: "FEATURE_UNAVAILABLE" },
  });
});
