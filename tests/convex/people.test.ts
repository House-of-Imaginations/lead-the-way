import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { firstNameOf, initialsOf } from "../../convex/lib/orgs/people";
import { seedAuthUser } from "./testHelpers";
import { harness, workspace } from "./workspace/helpers";

test("initials come from the first and last word", () => {
  expect(initialsOf("Priya Raman")).toBe("PR");
  expect(initialsOf("  tomás  de la reyes ")).toBe("TR");
  expect(initialsOf("Dan")).toBe("D");
  expect(initialsOf("   ")).toBe("?");
});

test("a first name survives stray whitespace", () => {
  expect(firstNameOf("Dan Okafor")).toBe("Dan");
  expect(firstNameOf("\tDan  Okafor ")).toBe("Dan");
  expect(firstNameOf("   ")).toBe("");
});

test("joining makes a people row with a name, initials and email", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, {});
  const roleId = roles.find((role) => !role.isOwner)!._id;
  const bob = await seedAuthUser(t, {
    name: "Bob Stone",
    email: "Bob@Example.com",
    emailVerified: true,
  });

  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
  });
  await t.withIdentity(bob).mutation(api.invites.accept, { token });

  const members = await owner.query(api.members.list, {});
  expect(members.find((m) => m.userId === bob.subject)).toMatchObject({
    name: "Bob Stone",
    email: "bob@example.com",
    roleId,
    isOwner: false,
  });
  const row = await t.run((ctx) =>
    ctx.db
      .query("people")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", bob.subject).eq("orgId", orgId),
      )
      .unique(),
  );
  expect(row).toMatchObject({
    initials: "BS",
    jobTitle: "",
    timeZone: "Australia/Melbourne",
  });
});

test("a profile is only a name and the workspace the app opens", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await owner.mutation(api.profiles.saveProfile, { displayName: "Pat" });

  const profile = await owner.query(api.profiles.me, {});
  expect(Object.keys(profile ?? {}).sort()).toEqual([
    "_creationTime",
    "_id",
    "activeOrgId",
    "createdAt",
    "displayName",
    "userId",
  ]);
  expect(profile).toMatchObject({ displayName: "Pat", activeOrgId: orgId });
});
