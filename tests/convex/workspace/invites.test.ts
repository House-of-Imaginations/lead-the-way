import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { personFields, seedAuthUser } from "../testHelpers";
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
    roleId,
    expectOrgId: orgId,
  });

  expect(await t.query(api.invites.publicPreview, { token })).toEqual({
    orgName: "Aster Network",
    orgImageUrl: null,
    emailPinned: false,
    invitedBy: "Someone",
    name: null,
    message: null,
    email: null,
    // A team member's invitation makes and pins setup's draft (M-g).
    join: expect.objectContaining({ course: "AI Productivity Fundamentals" }),
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
  // `create` refuses a second live invitation for one address (F2), so each
  // is made as a link and pinned after: they stand for rows made before it.
  const invite = async (email?: string) => {
    const made = await owner.mutation(api.invites.create, {
      roleId,
      expectOrgId: orgId,
    });
    if (email) await t.run((ctx) => ctx.db.patch(made.inviteId, { email }));
    return made;
  };

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
    inviteId: revoked.inviteId,
    expectOrgId: orgId,
  });
  // Revoking twice is a double tap, not an error.
  await expect(
    owner.mutation(api.invites.revoke, {
      inviteId: revoked.inviteId,
      expectOrgId: orgId,
    }),
  ).resolves.toBeNull();
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
  expect(await t.withIdentity(bob).query(api.orgs.myPermissions, {})).toEqual([
    "members:read",
  ]);
  expect(await owner.query(api.orgs.myPermissions, {})).toContain("org:manage");
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
    owner.mutation(api.invites.create, { roleId, email, expectOrgId: orgId });
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
    inviteId: revoked.inviteId,
    expectOrgId: orgId,
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
  // A pending, pinned link that has lapsed hides its address too.
  const lapsed = await create("lapsed@example.com");
  await t.run(async (ctx) => {
    await ctx.db.patch(lapsed.inviteId, { expiresAt: Date.now() - 1 });
  });
  expect(
    await t.query(api.invites.publicPreview, { token: lapsed.token }),
  ).toBeNull();
});

test("somebody already seated cannot burn an open link by declining it", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const member = await seat(t, orgId, "user_member", ["members:read"]);
  const { token } = await owner.mutation(api.invites.create, {
    roleId,
    expectOrgId: orgId,
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
    roleId,
    expectOrgId: orgId,
  });

  const rows = await owner.query(api.invites.list, {});
  expect(rows.find((row) => row.token === token)?.status).toBe("pending");
});

test("a resent invitation stays listed and counted however many newer ones lapse", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const old = await owner.mutation(api.invites.create, {
    roleId,
    email: "pat@example.com",
    expectOrgId: orgId,
  });
  const insert = (n: number, prefix: string, expiresAt: number) =>
    t.run(async (ctx) => {
      for (let i = 0; i < n; i++) {
        await ctx.db.insert("orgInvites", {
          orgId,
          roleId,
          token: `${prefix}-${i}`,
          status: "pending",
          invitedBy: "user_owner",
          expiresAt,
          createdAt: Date.now(),
        });
      }
    });
  // 100 newer invitations, all lapsed, then the old one is resent.
  await insert(100, "lapsed", Date.now() - 1);
  await owner.mutation(api.invites.resend, {
    inviteId: old.inviteId,
    expectOrgId: orgId,
  });

  const rows = await owner.query(api.invites.list, {});
  expect(rows.map((row) => row.token)).toEqual([old.token]);

  // 99 more live ones make 100 open with the resent one: the cap is reached.
  await insert(99, "live", Date.now() + 60_000);
  await expect(
    owner.mutation(api.invites.create, { roleId, expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
});

test("resend refuses a lapsed invitation and a role wider than the sender's", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const invite = (email: string) =>
    owner.mutation(api.invites.create, {
      roleId,
      email,
      expectOrgId: orgId,
    });

  // Holds members:manage but not the members:read the Member role grants.
  const admin = await seat(t, orgId, "user_admin", ["members:manage"]);
  const wide = await invite("pat@example.com");
  await expect(
    admin.as.mutation(api.invites.resend, {
      inviteId: wide.inviteId,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });

  const lapsed = await invite("kim@example.com");
  await t.run((ctx) =>
    ctx.db.patch(lapsed.inviteId, { expiresAt: Date.now() - 1 }),
  );
  await expect(
    owner.mutation(api.invites.resend, {
      inviteId: lapsed.inviteId,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({
    data: {
      code: "INVITE_EXPIRED",
      message: "That invitation has expired. Send a new one.",
    },
  });
  // Still lapsed: the refusal gave it no fresh week.
  const row = await t.run((ctx) => ctx.db.get(lapsed.inviteId));
  expect(row!.expiresAt).toBeLessThan(Date.now());
});

test("list shows answered rows and hides revoked and lapsed ones", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const create = () =>
    owner.mutation(api.invites.create, { roleId, expectOrgId: orgId });

  const accepted = await create();
  await t
    .withIdentity({ subject: "bob" })
    .mutation(api.invites.accept, { token: accepted.token });
  const declined = await create();
  await t
    .withIdentity({ subject: "carol" })
    .mutation(api.invites.decline, { token: declined.token });
  const revoked = await create();
  await owner.mutation(api.invites.revoke, {
    inviteId: revoked.inviteId,
    expectOrgId: orgId,
  });
  const lapsed = await create();
  await t.run((ctx) =>
    ctx.db.patch(lapsed.inviteId, { expiresAt: Date.now() - 1 }),
  );
  const open = await create();

  const statusOf = async () =>
    Object.fromEntries(
      (await owner.query(api.invites.list, {})).map((row) => [
        row.token,
        [row.status, row.roleName],
      ]),
    );
  expect(await statusOf()).toEqual({
    [accepted.token]: ["accepted", "Member"],
    [declined.token]: ["declined", "Member"],
    [open.token]: ["pending", "Member"],
  });

  // An answered row outlives its role; a pending one pinned to it does not.
  await t.run((ctx) => ctx.db.delete(roleId));
  expect(await statusOf()).toEqual({
    [accepted.token]: ["accepted", "Removed role"],
    [declined.token]: ["declined", "Removed role"],
  });
});

test("decline refuses the wrong account and finished links", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const bob = await seedAuthUser(t, {
    name: "Bob",
    email: "bob@example.com",
    emailVerified: true,
  });
  const carol = await seedAuthUser(t, {
    name: "Carol",
    email: "carol@example.com",
    emailVerified: true,
  });
  // `create` refuses a second live invitation for one address (F2), so each
  // is made as a link and pinned after: they stand for rows made before it.
  const invite = async () => {
    const made = await owner.mutation(api.invites.create, {
      roleId,
      expectOrgId: orgId,
    });
    await t.run((ctx) =>
      ctx.db.patch(made.inviteId, { email: "bob@example.com" }),
    );
    return made;
  };
  const declineAs = (who: { subject: string }, token: string) =>
    t.withIdentity(who).mutation(api.invites.decline, { token });

  const forBob = await invite();
  await expect(declineAs(carol, forBob.token)).rejects.toMatchObject({
    data: { code: "INVITE_WRONG_ACCOUNT" },
  });

  const revoked = await invite();
  await owner.mutation(api.invites.revoke, {
    inviteId: revoked.inviteId,
    expectOrgId: orgId,
  });
  await expect(declineAs(bob, revoked.token)).rejects.toMatchObject({
    data: { code: "INVITE_REVOKED" },
  });

  const lapsed = await invite();
  await t.run((ctx) =>
    ctx.db.patch(lapsed.inviteId, { expiresAt: Date.now() - 1 }),
  );
  await expect(declineAs(bob, lapsed.token)).rejects.toMatchObject({
    data: { code: "INVITE_EXPIRED" },
  });

  // None of the refusals answered the link.
  const statuses = await t.run(async (ctx) =>
    Promise.all(
      [forBob, revoked, lapsed].map(
        async ({ inviteId }) => (await ctx.db.get(inviteId))!.status,
      ),
    ),
  );
  expect(statuses).toEqual(["pending", "revoked", "pending"]);
});

test("a seat whose role is gone still counts as seated", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const { token } = await owner.mutation(api.invites.create, {
    roleId,
    expectOrgId: orgId,
  });
  // Corrupt on purpose: bob's seat points at a role that no longer exists.
  await t.run(async (ctx) => {
    const gone = await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Gone",
      permissions: [],
      createdAt: 0,
    });
    await ctx.db.insert("people", {
      orgId,
      roleId: gone,
      ...personFields("bob"),
    });
    await ctx.db.delete(gone);
  });
  await expect(
    t.withIdentity({ subject: "bob" }).mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "ALREADY_A_MEMBER" } });
});

test("the signed-out preview never shows the inviter's address", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  // An account with no name and no profile: only its address could stand in.
  const nameless = await seedAuthUser(t, {
    name: "",
    email: "nameless@example.com",
    emailVerified: true,
  });
  await t.run((ctx) =>
    ctx.db.insert("orgInvites", {
      orgId,
      roleId,
      token: "nameless",
      status: "pending",
      invitedBy: nameless.subject,
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    }),
  );
  expect(
    (await t.query(api.invites.publicPreview, { token: "nameless" }))
      ?.invitedBy,
  ).toBe("Someone");
});

test("a row stored before Ruling 4, with its trailing dot, still seats its address", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const dana = await seedAuthUser(t, {
    name: "Dana",
    email: "dana@example.com",
    emailVerified: false,
  });
  await t.run((ctx) =>
    ctx.db.insert("orgInvites", {
      orgId,
      roleId,
      token: "tok-dana",
      email: "dana@example.com.",
      status: "pending",
      invitedBy: "user_owner",
      expiresAt: Date.now() + 60_000,
      createdAt: 1,
    }),
  );
  await t
    .withIdentity(dana)
    .mutation(api.invites.accept, { token: "tok-dana" });
  expect(await t.withIdentity(dana).query(api.orgs.myPermissions, {})).toEqual([
    "members:read",
  ]);
});

test("an address that normalises to nothing is refused, never an open link", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  for (const email of [".", " . "]) {
    await expect(
      owner.mutation(api.invites.create, { roleId, email, expectOrgId: orgId }),
    ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  }
  // A blank field is still a shareable link, as before.
  const { token } = await owner.mutation(api.invites.create, {
    roleId,
    email: "  ",
    expectOrgId: orgId,
  });
  expect(await t.query(api.invites.publicPreview, { token })).toMatchObject({
    emailPinned: false,
  });
});

test("an address already in this workspace is refused (F2)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const create = (email: string) =>
    owner.mutation(api.invites.create, { roleId, email, expectOrgId: orgId });
  const already = {
    data: { code: "FIELD_REQUIRED", message: "Already in this workspace." },
  };

  // A seated person, however the address is cased.
  await seat(t, orgId, "user_pat", []);
  await expect(create(" User_Pat@Example.com ")).rejects.toMatchObject(already);

  // A live pending invitation.
  await create("sam@example.com");
  await expect(create("SAM@example.com")).rejects.toMatchObject(already);

  // A live row stored before Ruling 4, with its trailing dot.
  const old = await owner.mutation(api.invites.create, {
    roleId,
    expectOrgId: orgId,
  });
  await t.run((ctx) => ctx.db.patch(old.inviteId, { email: "ann@example." }));
  await expect(create("ann@example")).rejects.toMatchObject(already);
});

test("a revoked or lapsed invitation doesn't block a new one (F2)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roleId = await memberRole(t, orgId);
  const create = (email: string) =>
    owner.mutation(api.invites.create, { roleId, email, expectOrgId: orgId });

  const revoked = await create("rae@example.com");
  await owner.mutation(api.invites.revoke, {
    inviteId: revoked.inviteId,
    expectOrgId: orgId,
  });
  await expect(create("rae@example.com")).resolves.toMatchObject({
    emailed: false,
  });

  const lapsed = await create("lee@example.com");
  await t.run((ctx) =>
    ctx.db.patch(lapsed.inviteId, { expiresAt: Date.now() - 1 }),
  );
  await expect(create("lee@example.com")).resolves.toMatchObject({
    emailed: false,
  });
});
