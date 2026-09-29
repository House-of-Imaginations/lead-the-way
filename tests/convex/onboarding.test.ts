import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { seedAuthUser, seedDemoAccounts } from "./testHelpers";
import { harness, workspace, type T } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function account(t: T, name: string, email: string) {
  const { subject } = await seedAuthUser(t, {
    name,
    email,
    emailVerified: false,
  });
  return t.withIdentity({ subject });
}

async function orgsOf(t: T) {
  return await t.run((ctx) => ctx.db.query("orgs").collect());
}

test("sign-up needs the terms once, then makes a workspace and its team", async () => {
  const t = harness();
  const bec = await account(t, "Bec Hart", "bec@example.com");

  await expect(
    bec.mutation(api.onboarding.start, { acceptTerms: false }),
  ).rejects.toMatchObject({
    data: {
      code: "TERMS_REQUIRED",
      message: "Agree to the terms of use and privacy notice to continue.",
    },
  });
  expect(await orgsOf(t)).toEqual([]);

  expect(await bec.mutation(api.onboarding.start, { acceptTerms: true })).toBe(
    "/setup/team",
  );
  const [org] = await orgsOf(t);
  expect(org).toMatchObject({
    name: "Bec's workspace",
    slug: "bec-s-workspace",
    isDemo: false,
  });
  const team = await t.run((ctx) =>
    ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", org!._id))
      .unique(),
  );
  expect(team).toMatchObject({ name: "Your team", challenges: [] });
  expect(team?.savedAt).toBeUndefined();
  const profile = await bec.query(api.profiles.me, {});
  expect(profile?.termsAcceptedAt).toEqual(expect.any(Number));
  expect(profile?.activeOrgId).toBe(org!._id);

  // Shown once: the stored answer stands, and a second call makes nothing new.
  expect(await bec.mutation(api.onboarding.start, { acceptTerms: false })).toBe(
    "/home",
  );
  expect(await orgsOf(t)).toHaveLength(1);
});

test("two people with the same first name get two web addresses", async () => {
  const t = harness();
  await (
    await account(t, "Bec Hart", "bec@example.com")
  ).mutation(api.onboarding.start, { acceptTerms: true });
  await (
    await account(t, "Bec Lee", "bec.lee@example.com")
  ).mutation(api.onboarding.start, { acceptTerms: true });
  expect((await orgsOf(t)).map((o) => o.slug).sort()).toEqual([
    "bec-s-workspace",
    "bec-s-workspace-2",
  ]);
});

test("a blank display name makes a workspace named My workspace", async () => {
  const t = harness();
  const { subject } = await seedAuthUser(t, {
    name: "Pat Doe",
    email: "pat@example.com",
    emailVerified: false,
  });
  // Only a direct write can blank it; every writer falls back to a name.
  await t.run((ctx) =>
    ctx.db.insert("profiles", {
      userId: subject,
      displayName: "   ",
      createdAt: Date.now(),
    }),
  );
  const pat = t.withIdentity({ subject });

  expect(await pat.mutation(api.onboarding.start, { acceptTerms: true })).toBe(
    "/setup/team",
  );
  expect(await orgsOf(t)).toMatchObject([
    { name: "My workspace", slug: "my-workspace" },
  ]);
});

test("an invited address goes to its invitation and makes no workspace", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, { orgId });
  const roleId = roles.find((r) => r.name === "Employee")!._id;
  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: "Sam@Example.com",
  });
  const sam = await account(t, "Sam Ito", "sam@example.com");

  expect(await sam.mutation(api.onboarding.start, { acceptTerms: true })).toBe(
    `/join/${token}`,
  );
  expect(await orgsOf(t)).toHaveLength(1);
});

test("an expired invitation doesn't hold a new account back", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, { orgId });
  const roleId = roles.find((r) => r.name === "Employee")!._id;
  const { inviteId } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: "sam@example.com",
  });
  await t.run((ctx) => ctx.db.patch(inviteId, { expiresAt: Date.now() - 1 }));
  const sam = await account(t, "Sam Ito", "sam@example.com");

  expect(await sam.mutation(api.onboarding.start, { acceptTerms: true })).toBe(
    "/setup/team",
  );
});

test("a demo persona can't start a workspace of its own", async () => {
  vi.stubEnv("DEMO_MODE", "on");
  const t = harness();
  const accounts = await seedDemoAccounts(t);
  const dan = t.withIdentity({ subject: accounts.dan! });
  await expect(
    dan.mutation(api.onboarding.start, { acceptTerms: true }),
  ).rejects.toMatchObject({ data: { code: "DEMO_ACCOUNT_CREATE" } });
  expect(await orgsOf(t)).toEqual([]);
});
