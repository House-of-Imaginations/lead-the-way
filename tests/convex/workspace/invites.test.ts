import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { seedAuthUser } from "../testHelpers";
import { harness, seat, workspace, type T } from "./helpers";

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
    invitedBy: "Someone",
    name: null,
    message: null,
  });
  expect(
    await t.query(api.invites.publicPreview, { token: "nope" }),
  ).toBeNull();

  const bob = t.withIdentity({ subject: "bob" });
  expect(await bob.query(api.invites.preview, { token })).toMatchObject({
    acceptState: "READY",
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

test("accept refuses revoked and mismatched invitations", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  // Bob is unverified on purpose: a matching address is enough (spec 5).
  const bob = await seedAuthUser(t, {
    name: "Bob",
    email: "bob@example.com",
    emailVerified: false,
  });
  const carol = await seedAuthUser(t, {
    name: "Carol",
    email: "carol@example.com",
    emailVerified: true,
  });
  const invite = (email?: string) =>
    owner.mutation(api.invites.create, { orgId, roleId, email });

  const refused = async (
    who: { subject: string },
    token: string,
    code: string,
  ) => {
    const error = await t
      .withIdentity(who)
      .mutation(api.invites.accept, { token })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).toMatchObject({ data: { code } });
    // Whatever went wrong, the answer never says who the link was for.
    expect(JSON.stringify((error as { data: unknown }).data)).not.toContain(
      "bob@example.com",
    );
  };

  const forBob = await invite("bob@example.com");
  await refused(carol, forBob.token, "INVITE_WRONG_ACCOUNT");

  const revoked = await invite("bob@example.com");
  await owner.mutation(api.invites.revoke, {
    orgId,
    inviteId: revoked.inviteId,
  });
  await refused(bob, revoked.token, "INVITE_REVOKED");

  const declined = await invite("bob@example.com");
  await t
    .withIdentity(bob)
    .mutation(api.invites.decline, { token: declined.token });
  await refused(bob, declined.token, "INVITE_DECLINED");

  await t
    .withIdentity(bob)
    .mutation(api.invites.accept, { token: forBob.token });
  await refused(bob, forBob.token, "INVITE_USED");
  await refused(carol, forBob.token, "INVITE_USED");

  // Already seated: an open link does nothing, for a member or for the owner.
  const open = await invite();
  await refused(bob, open.token, "ALREADY_A_MEMBER");
  await refused({ subject: "user_owner" }, open.token, "ALREADY_A_MEMBER");

  // No refusal moved anybody's role, and every row says what happened to it.
  expect(
    await t.withIdentity(bob).query(api.orgs.myPermissions, { orgId }),
  ).toEqual(["members:read"]);
  expect(await owner.query(api.orgs.myPermissions, { orgId })).toContain(
    "org:manage",
  );
  const statuses = await t.run(async (ctx) =>
    (await ctx.db.query("orgInvites").collect())
      .map((row) => row.status)
      .sort(),
  );
  expect(statuses).toEqual(["accepted", "declined", "pending", "revoked"]);
});

test("preview names each accept state", async () => {
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
  const create = (email?: string) =>
    owner.mutation(api.invites.create, { orgId, roleId, email });
  const pinned = await create("carol@example.com");
  const open = await create();
  const stateOf = async (who: { subject: string }, token: string) =>
    (await t.withIdentity(who).query(api.invites.preview, { token }))
      ?.acceptState ?? null;

  expect(await stateOf(dan, pinned.token)).toBe("WRONG_ACCOUNT");
  // Unverified is fine: the address matches.
  expect(await stateOf(carol, pinned.token)).toBe("READY");
  expect(await stateOf({ subject: "user_owner" }, open.token)).toBe(
    "ALREADY_MEMBER",
  );
  expect(await stateOf(dan, open.token)).toBe("READY");

  const revoked = await create();
  await owner.mutation(api.invites.revoke, {
    orgId,
    inviteId: revoked.inviteId,
  });
  expect(await stateOf(dan, revoked.token)).toBe("REVOKED");

  const declined = await create("dan@example.com");
  await t
    .withIdentity(dan)
    .mutation(api.invites.decline, { token: declined.token });
  expect(await stateOf(dan, declined.token)).toBe("DECLINED");

  await t
    .withIdentity(carol)
    .mutation(api.invites.accept, { token: pinned.token });
  expect(await stateOf(dan, pinned.token)).toBe("USED");

  // Nonsense and lapsed links have nothing to show.
  expect(await stateOf(dan, "nope")).toBeNull();
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("orgInvites")
      .withIndex("by_token", (q) => q.eq("token", open.token))
      .unique();
    await ctx.db.patch(row!._id, { expiresAt: Date.now() - 1 });
  });
  expect(await stateOf(dan, open.token)).toBeNull();

  // Signed out, only a pending link previews.
  expect(
    await t.query(api.invites.publicPreview, { token: pinned.token }),
  ).toBeNull();
  expect(
    await t.query(api.invites.publicPreview, { token: declined.token }),
  ).toBeNull();
});

test("somebody already seated cannot burn an open link by declining it", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const member = await seat(t, orgId, "user_member", ["members:read"]);
  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
  });

  for (const who of [owner, member.as]) {
    await expect(
      who.mutation(api.invites.decline, { token }),
    ).rejects.toMatchObject({ data: { code: "ALREADY_A_MEMBER" } });
  }
  // Still pending, so the person it was meant for can still use it.
  await expect(
    t.withIdentity({ subject: "dan" }).mutation(api.invites.accept, { token }),
  ).resolves.toMatchObject({ orgId });
});

test("old answered invitations never push a pending one off the list", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  // Accepted sorts before pending in the index. 300 is more than the list
  // reads of any one status, and enough to fill one window over all of them.
  await t.run(async (ctx) => {
    for (let i = 0; i < 300; i++) {
      await ctx.db.insert("orgInvites", {
        orgId,
        roleId,
        token: `old-${i}`,
        status: "accepted",
        invitedBy: "user_owner",
        expiresAt: 0,
        createdAt: 0,
      });
    }
  });
  const { token } = await owner.mutation(api.invites.create, {
    orgId,
    roleId,
  });

  const rows = await owner.query(api.invites.list, { orgId });
  expect(rows.find((row) => row.token === token)?.status).toBe("pending");
});
