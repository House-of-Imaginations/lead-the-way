import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { seedAuthUser } from "../testHelpers";
import { harness, workspace, type T } from "./helpers";

const memberRole = (t: T, orgId: Id<"orgs">) =>
  t.run((ctx) =>
    ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Member",
      permissions: ["members:read"],
      createdAt: Date.now(),
    }),
  );
test("an invite seats the person and opens the workspace", async () => {
  const t = harness();
  const { owner, orgId, slug } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
  });

  expect(await t.query(api.invites.publicPreview, { token })).toEqual({
    orgName: "Aster Network",
    orgImageUrl: null,
    emailPinned: false,
  });
  expect(
    await t.query(api.invites.publicPreview, { token: "nope" }),
  ).toBeNull();

  const bob = t.withIdentity({ subject: "bob" });
  expect(await bob.query(api.invites.preview, { token })).toMatchObject({
    acceptState: "READY",
    access: "ready",
    emailConfigured: false,
  });
  expect(await bob.mutation(api.invites.accept, { token })).toEqual({
    slug,
    orgId,
  });
  const state = await t.run(async (ctx) => ({
    seat: await ctx.db
      .query("people")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", "bob").eq("orgId", orgId),
      )
      .unique(),
    active: await bob.query(api.orgs.active, {}),
  }));
  expect(state.seat?.roleId).toBe(roleId);
  expect(state.active?.org._id).toBe(orgId);
});

test("preview names the four accept states", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const carol = await seedAuthUser(t, {
    name: "Carol",
    email: "carol@example.com",
    emailVerified: false,
  });
  const dan = await seedAuthUser(t, {
    name: "Dan",
    email: "dan@example.com",
    emailVerified: true,
  });
  const pinned = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: "carol@example.com",
  });
  const open = await owner.mutation(api.invites.create, { orgId, roleId });
  const stateOf = async (who: { subject: string }, token: string) =>
    (await t.withIdentity(who).query(api.invites.preview, { token }))
      ?.acceptState;

  expect(await stateOf(dan, pinned.token)).toBe("WRONG_ACCOUNT");
  expect(await stateOf(carol, pinned.token)).toBe("VERIFY_EMAIL");
  expect(await stateOf({ subject: "user_owner" }, open.token)).toBe(
    "ALREADY_MEMBER",
  );
  expect(await stateOf(dan, open.token)).toBe("READY");
  expect(
    (await t.query(api.invites.publicPreview, { token: pinned.token }))
      ?.emailPinned,
  ).toBe(true);
});
