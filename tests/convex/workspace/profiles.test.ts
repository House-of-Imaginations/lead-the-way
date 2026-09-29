import { expect, test } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { seedAuthUser } from "../testHelpers";
import { harness, seat, workspace } from "./helpers";

test("the auth trigger creates a profile once, named from the account", async () => {
  const t = harness();
  const doc = { _id: "user_pat", name: "Pat Lee", email: "pat@example.com" };
  await t.mutation(internal.auth.onCreate, { model: "user", doc });
  await t.mutation(internal.auth.onCreate, { model: "user", doc });
  const rows = await t.run((ctx) =>
    ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", "user_pat"))
      .take(5),
  );
  expect(rows.map((r) => r.displayName)).toEqual(["Pat Lee"]);
});

test("saveProfile on an account with no row creates it through ensureProfile", async () => {
  const t = harness();
  const pat = await seedAuthUser(t, {
    name: "Pat Lee",
    email: "pat@example.com",
    emailVerified: true,
  });
  await t
    .withIdentity(pat)
    .mutation(api.profiles.saveProfile, { displayName: "Pat" });
  expect(await t.withIdentity(pat).query(api.profiles.me, {})).toMatchObject({
    displayName: "Pat",
  });
});

test("orgs.active follows setActiveOrg and falls back when the seat is gone", async () => {
  const t = harness();
  const { owner, orgId: first } = await workspace(t, "First Network");
  // create sets the active org to the newest workspace.
  const { orgId: second } = await owner.mutation(api.orgs.create, {
    name: "Second Network",
  });
  expect((await owner.query(api.orgs.active, {}))?.org._id).toBe(second);

  await owner.mutation(api.profiles.setActiveOrg, { orgId: first });
  expect(await owner.query(api.orgs.active, {})).toMatchObject({
    org: { _id: first },
    isOwner: true,
  });

  const { as: bob, personId } = await seat(t, first, "user_bob", [
    "members:read",
  ]);
  await bob.mutation(api.profiles.setActiveOrg, { orgId: first });
  await t.run((ctx) => ctx.db.delete(personId));
  expect(await bob.query(api.orgs.active, {})).toBeNull();
  await expect(
    t
      .withIdentity({ subject: "user_stranger" })
      .mutation(api.profiles.setActiveOrg, { orgId: first }),
  ).rejects.toMatchObject({ data: { code: "NOT_A_MEMBER" } });
});
