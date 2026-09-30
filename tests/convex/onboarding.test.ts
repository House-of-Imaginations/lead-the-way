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

async function account(t: T, name: string, email: string, verified = false) {
  const { subject } = await seedAuthUser(t, {
    name,
    email,
    emailVerified: verified,
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

test("a user with no name makes a workspace named My workspace", async () => {
  const t = harness();
  const pat = await account(t, "  ", "pat@example.com");

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
  const sam = await account(t, "Sam Ito", "sam@example.com", true);

  expect(await sam.mutation(api.onboarding.start, { acceptTerms: true })).toBe(
    `/join/${token}`,
  );
  expect(await orgsOf(t)).toHaveLength(1);
});

test("an unverified address never learns the invitation token", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, { orgId });
  const roleId = roles.find((r) => r.name === "Employee")!._id;
  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: "sam@example.com",
  });
  const eve = await account(t, "Eve", "sam@example.com", false);

  const to = await eve.mutation(api.onboarding.start, { acceptTerms: true });
  expect(to).toBe("/setup/team");
  expect(to).not.toContain(token);
  expect(await orgsOf(t)).toHaveLength(2);
});

test.each(["revoked", "accepted"] as const)(
  "a %s invitation doesn't hold a verified account back",
  async (status) => {
    const t = harness();
    const { owner, orgId } = await workspace(t);
    const roles = await owner.query(api.orgRoles.list, { orgId });
    const roleId = roles.find((r) => r.name === "Employee")!._id;
    const { inviteId } = await owner.mutation(api.invites.create, {
      orgId,
      roleId,
      email: "sam@example.com",
    });
    await t.run((ctx) => ctx.db.patch(inviteId, { status }));
    const sam = await account(t, "Sam Ito", "sam@example.com", true);

    expect(
      await sam.mutation(api.onboarding.start, { acceptTerms: true }),
    ).toBe("/setup/team");
  },
);

test("an invitation from the demo workspace doesn't hold a verified account back", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, { orgId });
  const roleId = roles.find((r) => r.name === "Employee")!._id;
  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: "sam@example.com",
  });
  await t.run((ctx) => ctx.db.patch(orgId, { isDemo: true }));
  const sam = await account(t, "Sam Ito", "sam@example.com", true);

  const to = await sam.mutation(api.onboarding.start, { acceptTerms: true });
  expect(to).toBe("/setup/team");
  expect(to).not.toContain(token);
});

test("a first name too long for a workspace name makes My workspace", async () => {
  const t = harness();
  const long = await account(t, `${"a".repeat(49)} Lee`, "long@example.com");
  expect(await long.mutation(api.onboarding.start, { acceptTerms: true })).toBe(
    "/setup/team",
  );
  expect(await orgsOf(t)).toMatchObject([{ name: "My workspace" }]);
});

test("a seated account that never agreed to the terms is asked to", async () => {
  const t = harness();
  const { owner } = await workspace(t);
  await expect(
    owner.mutation(api.onboarding.start, { acceptTerms: false }),
  ).rejects.toMatchObject({ data: { code: "TERMS_REQUIRED" } });
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

test("a long name cut on a hyphen still gets a clean second address", async () => {
  const t = harness();
  const first = `${"a".repeat(44)}-b`;
  await (
    await account(t, `${first} One`, "one@example.com")
  ).mutation(api.onboarding.start, { acceptTerms: true });
  await (
    await account(t, `${first} Two`, "two@example.com")
  ).mutation(api.onboarding.start, { acceptTerms: true });
  const slugs = (await orgsOf(t)).map((o) => o.slug);
  expect(slugs).toHaveLength(2);
  expect(slugs).toHaveLength(2);
  for (const slug of slugs) expect(slug).not.toContain("--");
});
