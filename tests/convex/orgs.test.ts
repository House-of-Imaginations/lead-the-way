/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { personFields, registerComponents, seedAuthUser } from "./testHelpers";

/**
 * Organizations, and the four ways this feature can go badly wrong.
 *
 * The happy path is the cheapest thing to test here and the least likely to
 * break. What earns its place instead:
 *
 *  - the AUTHORISATION boundary: a non-member, and a member without the
 *    permission the function names;
 *  - ESCALATION: the reason custom roles are not just decoration. Without the
 *    subset rules, `roles:manage` is owner and `members:manage` can seize the
 *    workspace;
 *  - LOCKOUT: an org left with nobody who can administer it. Unrecoverable, so
 *    every path into it is pinned here;
 *  - the INVITE as a credential: single use, expiry, and the fact that
 *    accepting is insert-only.
 */
const modules = import.meta.glob("../../convex/**/*.ts");

const ALICE = { subject: "user_alice" };
const BOB = { subject: "user_bob" };
const CAROL = { subject: "user_carol" };

function harness() {
  const t = convexTest(schema, modules);
  registerComponents(t);
  return t;
}

/** Alice makes a workspace and owns it. The starting point for most tests. */
async function workspace(t: ReturnType<typeof harness>) {
  const { orgId, slug } = await t
    .withIdentity(ALICE)
    .mutation(api.orgs.create, { name: "Acme" });
  return { orgId, slug };
}

test("creating a workspace makes a Manager, an Employee role and one seat", async () => {
  const t = harness();
  const { orgId } = await workspace(t);

  const rows = await t.run(async (ctx) => ({
    roles: await ctx.db.query("orgRoles").collect(),
    members: await ctx.db.query("people").collect(),
  }));

  // The owner, plus a role to invite people as. Employee holds nothing: every
  // manager screen needs a permission the owner has and it doesn't.
  expect(
    rows.roles.map((role) => [
      role.kind,
      role.name,
      role.kind === "custom" ? role.permissions : "all",
    ]),
  ).toEqual([
    ["owner", "Manager", "all"],
    ["custom", "Employee", []],
  ]);
  expect(rows.members).toHaveLength(1);
  expect(rows.members[0].userId).toBe(ALICE.subject);
  expect(rows.members[0].orgId).toBe(orgId);
});

test("the owner role has every permission without storing any", async () => {
  const t = harness();
  const { orgId } = await workspace(t);

  const permissions = await t
    .withIdentity(ALICE)
    .query(api.orgs.myPermissions, { orgId });

  // Resolved from the code constant, so a permission added later reaches every
  // existing owner on deploy rather than needing a migration.
  expect(permissions).toContain("org:manage");
  expect(permissions).toContain("roles:manage");
  expect(permissions).toContain("members:manage");

  const stored = await t.run(
    async (ctx) => (await ctx.db.query("orgRoles").collect())[0],
  );
  expect(stored).not.toHaveProperty("permissions");
});

test("a signed-out caller reaches nothing", async () => {
  const t = harness();
  const { orgId } = await workspace(t);

  await expect(t.query(api.orgs.mine, {})).rejects.toThrow(ConvexError);
  await expect(t.query(api.members.list, { orgId })).rejects.toThrow(
    ConvexError,
  );
});

test("a stranger is not told whether the workspace exists", async () => {
  const t = harness();
  const { orgId } = await workspace(t);

  // Same code for "no such org" and "not yours", so probing ids learns nothing.
  await expect(
    t.withIdentity(BOB).query(api.members.list, { orgId }),
  ).rejects.toMatchObject({ data: { code: "NOT_A_MEMBER" } });

  await expect(
    t.withIdentity(BOB).query(api.orgs.bySlug, { slug: "acme" }),
  ).resolves.toBeNull();
});

test("a slug that would shadow a route is refused", async () => {
  const t = harness();
  // `/orgs/new` is a screen. An org slugged `new` would make every link to the
  // create page open the org instead.
  await expect(
    t.withIdentity(ALICE).mutation(api.orgs.create, { name: "New" }),
  ).rejects.toMatchObject({ data: { code: "SLUG_TAKEN" } });
});

test("two spellings of one name cannot become two workspaces", async () => {
  const t = harness();
  await t.withIdentity(ALICE).mutation(api.orgs.create, { name: "Acme" });

  await expect(
    t.withIdentity(BOB).mutation(api.orgs.create, { name: "  ACME  " }),
  ).rejects.toMatchObject({ data: { code: "SLUG_TAKEN" } });
});

/**
 * THE ESCALATION SET. Without the subset rules in `lib/orgs/permissions.ts`,
 * every one of these passes and custom roles mean nothing: `roles:manage` can
 * write itself a bigger role, and `members:manage` can move itself into one.
 */
test("a role cannot be created with more than the caller holds", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  // Alice gives Bob a role that can manage roles, and nothing else.
  const editorId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Editor",
    permissions: ["roles:manage"],
  });
  const token = await alice.mutation(api.invites.create, {
    orgId,
    roleId: editorId,
  });
  await t
    .withIdentity(BOB)
    .mutation(api.invites.accept, { token: token.token });

  // Bob may make roles, but not ones that reach further than his own.
  await expect(
    t.withIdentity(BOB).mutation(api.orgRoles.create, {
      orgId,
      name: "Sneaky",
      permissions: ["org:manage"],
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
});

test("a role cannot be widened past the caller's own reach", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const editorId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Editor",
    permissions: ["roles:manage"],
  });
  const token = await alice.mutation(api.invites.create, {
    orgId,
    roleId: editorId,
  });
  await t
    .withIdentity(BOB)
    .mutation(api.invites.accept, { token: token.token });

  // Bob editing his own role to add everything is the whole attack.
  await expect(
    t.withIdentity(BOB).mutation(api.orgRoles.update, {
      orgId,
      roleId: editorId,
      name: "Editor",
      permissions: ["roles:manage", "org:manage", "members:manage"],
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
});

test("an admin cannot promote somebody past themselves, or evict an owner", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const adminId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Admin",
    permissions: ["members:read", "members:manage"],
  });
  const token = await alice.mutation(api.invites.create, {
    orgId,
    roleId: adminId,
  });
  await t
    .withIdentity(BOB)
    .mutation(api.invites.accept, { token: token.token });

  const members = await t.withIdentity(BOB).query(api.members.list, { orgId });
  const aliceSeat = members.find((m) => m.userId === ALICE.subject)!;

  // Bob manages members, but Alice reaches further than he does.
  await expect(
    t.withIdentity(BOB).mutation(api.members.remove, {
      orgId,
      personId: aliceSeat.personId,
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });

  const bobSeat = members.find((m) => m.userId === BOB.subject)!;
  await expect(
    t.withIdentity(BOB).mutation(api.members.changeRole, {
      orgId,
      personId: bobSeat.personId,
      roleId: aliceSeat.roleId,
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
});

/**
 * THE LOCKOUT SET. An org with nobody able to administer it cannot be repaired
 * from inside the product, so each of these is pinned separately.
 */
test("the owner role cannot be deleted or edited", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const roles = await alice.query(api.orgRoles.list, { orgId });
  const owner = roles.find((r) => r.isOwner)!;

  await expect(
    alice.mutation(api.orgRoles.remove, { orgId, roleId: owner._id }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

  await expect(
    alice.mutation(api.orgRoles.update, {
      orgId,
      roleId: owner._id,
      name: "Owner",
      permissions: [],
    }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});

test("the last owner cannot leave, be removed, or be demoted", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const members = await alice.query(api.members.list, { orgId });
  const seat = members[0];

  await expect(
    alice.mutation(api.members.leave, { orgId }),
  ).rejects.toMatchObject({ data: { code: "LAST_OWNER" } });
  await expect(
    alice.mutation(api.members.remove, {
      orgId,
      personId: seat.personId,
    }),
  ).rejects.toMatchObject({ data: { code: "LAST_OWNER" } });
  await expect(
    alice.mutation(api.members.changeRole, {
      orgId,
      personId: seat.personId,
      roleId: memberId,
    }),
  ).rejects.toMatchObject({ data: { code: "LAST_OWNER" } });
});

test("a role somebody still holds cannot be deleted", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const token = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });
  await t
    .withIdentity(BOB)
    .mutation(api.invites.accept, { token: token.token });

  // Cascading would evict Bob as a side effect of tidying roles; reassigning
  // would silently change what he can do. Refusing is the only one that isn't
  // a surprise.
  await expect(
    alice.mutation(api.orgRoles.remove, { orgId, roleId: memberId }),
  ).rejects.toMatchObject({ data: { code: "ROLE_IN_USE" } });
});

/** THE INVITE AS A CREDENTIAL. */
test("an invitation is single use and cannot be replayed", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });

  await t.withIdentity(BOB).mutation(api.invites.accept, { token });
  await expect(
    t.withIdentity(CAROL).mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "INVITE_USED" } });
});

test("an invitation cannot hand over ownership", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);
  const roles = await alice.query(api.orgRoles.list, { orgId });
  const owner = roles.find((r) => r.isOwner)!;

  await expect(
    alice.mutation(api.invites.create, { orgId, roleId: owner._id }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});

/**
 * THE SELF-DEMOTION PRIMITIVE. If accepting patched an existing seat,
 * any invitation link would demote whoever opened it -- including an owner
 * opening an "Employee" link somebody sent them.
 */
test("accepting an invitation never changes a role you already have", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });

  // The owner opens a member-level link for her own workspace.
  await expect(
    alice.mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "ALREADY_A_MEMBER" } });

  const permissions = await alice.query(api.orgs.myPermissions, { orgId });
  expect(permissions).toContain("org:manage");
});

test("an expired invitation is refused", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });

  await t.run(async (ctx) => {
    const invite = await ctx.db.query("orgInvites").first();
    await ctx.db.patch(invite!._id, { expiresAt: Date.now() - 1 });
  });

  await expect(
    t.withIdentity(BOB).mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "INVITE_EXPIRED" } });
});

test("widening a role revokes the invitations written for what it was", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });

  await alice.mutation(api.orgRoles.update, {
    orgId,
    roleId: memberId,
    name: "Member",
    permissions: ["members:read", "members:manage"],
  });

  // The link promised a reader's seat. It does not silently become an admin's.
  await expect(
    t.withIdentity(BOB).mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "INVITE_REVOKED" } });
});

test("a pinned invitation is refused for anybody but its address", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  // Real auth rows, not claims: the check under test reads the component's
  // own document, because a JWT says whatever it was minted with.
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
  const dan = await seedAuthUser(t, {
    name: "Dan",
    email: "dan@example.com",
    emailVerified: false,
  });

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token, emailed } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
    email: "Bob@Example.com ",
  });

  // No sending domain in the test environment, so nothing goes out and the
  // link still works. The feature detects its own absence.
  expect(emailed).toBe(false);

  await expect(
    t.withIdentity(carol).mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "INVITE_WRONG_ACCOUNT" } });

  // His own address, unverified: the link in his inbox is the proof (spec 5).
  const pinnedToDan = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
    email: "dan@example.com",
  });
  await expect(
    t
      .withIdentity(dan)
      .mutation(api.invites.accept, { token: pinnedToDan.token }),
  ).resolves.toMatchObject({ slug: "acme" });

  const stateFor = async (who: typeof bob, invite: string) =>
    (await t.withIdentity(who).query(api.invites.preview, { token: invite }))
      ?.acceptState;
  expect(await stateFor(bob, token)).toBe("READY");
  expect(await stateFor(carol, token)).toBe("WRONG_ACCOUNT");

  // Normalised on both sides, so the casing and the stray space do not matter.
  await expect(
    t.withIdentity(bob).mutation(api.invites.accept, { token }),
  ).resolves.toMatchObject({ slug: "acme" });
});

test("resending a pinned invitation keeps its link and restarts its week", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);
  const roles = await alice.query(api.orgRoles.list, { orgId });
  const employee = roles.find((role) => role.name === "Employee")!;

  const pinned = await alice.mutation(api.invites.create, {
    orgId,
    roleId: employee._id,
    email: "bob@example.com",
  });
  const [before] = await alice.query(api.invites.list, { orgId });
  await t.run(async (ctx) => {
    await ctx.db.patch(before._id, { expiresAt: Date.now() + 1000 });
  });

  const { emailed } = await alice.mutation(api.invites.resend, {
    orgId,
    inviteId: before._id,
  });
  // No sending domain in tests, and the resend says so rather than pretending.
  expect(emailed).toBe(false);

  const [after] = await alice.query(api.invites.list, { orgId });
  expect(after.token).toBe(pinned.token);
  expect(after.expiresAt).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);

  // A plain link has no address to resend to.
  await alice.mutation(api.invites.create, { orgId, roleId: employee._id });
  const link = (await alice.query(api.invites.list, { orgId })).find(
    (invite) => invite.email === null,
  )!;
  await expect(
    alice.mutation(api.invites.resend, { orgId, inviteId: link._id }),
  ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
});

test("only somebody who may manage members can read the tokens", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });
  await t.withIdentity(BOB).mutation(api.invites.accept, { token });

  await expect(
    t.withIdentity(BOB).query(api.invites.list, { orgId }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
});

/**
 * The guards added after review, each of which was a real hole.
 *
 * They share a shape: something that looked like it only narrowed, or only
 * counted, and turned out to be a way around a rule stated elsewhere.
 */
test("narrowing a stronger role is escalation, not housekeeping", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  // Bob may edit roles and nothing else.
  const editorId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Editor",
    permissions: ["roles:manage"],
  });
  const adminId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Admin",
    permissions: ["org:manage", "members:manage"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: editorId,
  });
  await t.withIdentity(BOB).mutation(api.invites.accept, { token });
  const bob = t.withIdentity(BOB);

  // Adding is refused, which `requireWithin` already covered.
  await expect(
    bob.mutation(api.orgRoles.update, {
      orgId,
      roleId: editorId,
      name: "Editor",
      permissions: ["roles:manage", "org:manage"],
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });

  // STRIPPING is refused too, and that is the one that was missing: nothing is
  // added, so the subset check passes vacuously and a role editor could quietly
  // disarm every administrator in the workspace.
  await expect(
    bob.mutation(api.orgRoles.update, {
      orgId,
      roleId: adminId,
      name: "Admin",
      permissions: [],
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });

  // And so is deleting it outright, which is the same act with fewer steps.
  await expect(
    bob.mutation(api.orgRoles.remove, { orgId, roleId: adminId }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
});

test("a lapsed invitation does not hold a slot forever", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });

  // Age it past its window, and fill the rest of the cap (100) straight into
  // the table: the rate limit would stop a loop of `create` long before that.
  // `list` hides a lapsed row, so if it counted, the cap would brick itself
  // with nothing visible to revoke.
  const lapsed = await t.run(async (ctx) => {
    const invite = await ctx.db
      .query("orgInvites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    await ctx.db.patch(invite!._id, { expiresAt: Date.now() - 1 });
    for (let i = 1; i < 100; i++) {
      await ctx.db.insert("orgInvites", {
        orgId,
        roleId: memberId,
        token: `live-${i}`,
        status: "pending",
        invitedBy: ALICE.subject,
        expiresAt: Date.now() + 60_000,
        createdAt: Date.now(),
      });
    }
    return invite!._id;
  });

  await expect(
    t.withIdentity(BOB).mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "INVITE_EXPIRED" } });

  // 99 live and one lapsed: the lapsed one frees its slot...
  await alice.mutation(api.invites.create, { orgId, roleId: memberId });
  // ...and now the cap is really full.
  await expect(
    alice.mutation(api.invites.create, { orgId, roleId: memberId }),
  ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });

  // Nothing was deleted to make room: the row keeps its history (spec 5).
  const row = await t.run(async (ctx) => ctx.db.get(lapsed));
  expect(row?.status).toBe("pending");
});

test("a workspace name cannot carry an email header into a subject line", async () => {
  const t = harness();
  const { orgId } = await t
    .withIdentity(ALICE)
    .mutation(api.orgs.create, { name: "Acme\r\nBcc: someone@example.com" });

  const seated = await t
    .withIdentity(ALICE)
    .query(api.orgs.bySlug, { slug: "acme-bcc-someone-example-com" });
  expect(seated?.org.name).toBe("Acme  Bcc: someone@example.com");
  expect(seated?.org.name).not.toContain("\r");
  expect(orgId).toBeDefined();
});

test("accepting an invite gives the new member a display name", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const alice = t.withIdentity(ALICE);

  const memberId = await alice.mutation(api.orgRoles.create, {
    orgId,
    name: "Member",
    permissions: ["members:read"],
  });
  const { token } = await alice.mutation(api.invites.create, {
    orgId,
    roleId: memberId,
  });

  const bob = await seedAuthUser(t, {
    name: "Bob",
    email: "bob@example.com",
    emailVerified: true,
  });
  await t.withIdentity(bob).mutation(api.invites.accept, { token });

  const members = await alice.query(api.members.list, { orgId });
  const seat = members.find((member) => member.userId === bob.subject);
  // `insertPerson` names the seat from his profile, which `ensureProfile`
  // creates from his auth account.
  expect(seat?.name).toBe("Bob");

  // Alice has no auth row seeded and no profile either, which is the only case
  // the placeholder is left for.
  const owner = members.find((member) => member.isOwner);
  expect(owner?.name).toBe("Someone");
});

test("there is a ceiling on how many workspaces one account can hold", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);

  // The ceiling is 50, and it is enforced rather than decorative: `seatsOfUser`
  // reads exactly that many, so a seat past it would never show. See
  // `convex/lib/orgs/membership.ts`.
  for (let n = 0; n < 50; n += 1) {
    await alice.mutation(api.orgs.create, { name: `Workspace ${n}` });
  }
  await expect(
    alice.mutation(api.orgs.create, { name: "One too many" }),
  ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
});

/**
 * The workspace picture.
 *
 * WHAT CANNOT BE TESTED HERE, stated so nobody spends an afternoon on it again:
 * `convex-test`'s `ctx.storage.store()` DROPS the blob's type. `ctx.db.system`
 * comes back with `sha256` and `size` and no `contentType` at all, so
 * `setImage`'s type gate refuses every file a test can produce. The gate itself
 * is the one thing standing between this product and a stored SVG -- an image
 * by MIME and a script-execution surface -- so it is not going anywhere; it is
 * simply unreachable from here until the harness records the type.
 *
 * That leaves the parts that are real in a test, and they are the ones with
 * teeth anyway: the AUTHORISATION boundary, and the CASCADE. A picture left in
 * storage after its workspace is gone is a leak nobody ever notices, which is
 * exactly the class of defect `profiles.test.ts` already pins for accounts.
 */
test("a member without org:manage cannot touch the workspace picture", async () => {
  const t = harness();
  const { orgId } = await workspace(t);

  // Bob joins with a role that can read members and nothing else.
  const roleId = await t.withIdentity(ALICE).mutation(api.orgRoles.create, {
    orgId,
    name: "Reader",
    permissions: ["members:read"],
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("people", {
      orgId,
      roleId,
      ...personFields(BOB.subject),
    });
  });

  const file = await t.run(async (ctx) =>
    ctx.storage.store(new Blob(["pretend png"], { type: "image/png" })),
  );

  await expect(
    t.withIdentity(BOB).mutation(api.orgs.setImage, { orgId, storageId: file }),
  ).rejects.toThrow(ConvexError);
  await expect(
    t.withIdentity(BOB).mutation(api.orgs.clearImage, { orgId }),
  ).rejects.toThrow(ConvexError);
  // Minting an upload URL is write access to this deployment's storage, so it
  // is gated on `org:manage` rather than on membership alone -- otherwise every
  // member of every workspace could fill the deployment with files.
  await expect(
    t.withIdentity(BOB).mutation(api.orgs.generateImageUploadUrl, { orgId }),
  ).rejects.toThrow(ConvexError);
});

test("clearing a workspace picture deletes the bytes", async () => {
  const t = harness();
  const { orgId, slug } = await workspace(t);

  // Set directly, for the harness reason above.
  const file = await t.run(async (ctx) => {
    const stored = await ctx.storage.store(
      new Blob(["pretend png"], { type: "image/png" }),
    );
    await ctx.db.patch(orgId, { imageId: stored });
    return stored;
  });

  const before = await t.withIdentity(ALICE).query(api.orgs.bySlug, { slug });
  expect(before?.org.imageUrl).toEqual(expect.any(String));
  // The handle itself is never on the wire -- only a URL minted per read, since
  // a stored Convex storage URL is signed and expiring.
  expect(before?.org).not.toHaveProperty("imageId");

  await t.withIdentity(ALICE).mutation(api.orgs.clearImage, { orgId });

  const after = await t.run(async (ctx) => ({
    file: await ctx.db.system.get(file),
    org: await ctx.db.get(orgId),
  }));
  expect(after.file).toBeNull();
  expect(after.org?.imageId).toBeUndefined();
});

test("deleting a workspace takes its picture with it", async () => {
  const t = harness();
  const { orgId } = await workspace(t);

  const file = await t.run(async (ctx) => {
    const stored = await ctx.storage.store(
      new Blob(["pretend png"], { type: "image/png" }),
    );
    await ctx.db.patch(orgId, { imageId: stored });
    return stored;
  });

  await t.withIdentity(ALICE).mutation(api.orgs.remove, { orgId });

  const after = await t.run(async (ctx) => ({
    file: await ctx.db.system.get(file),
    org: await ctx.db.get(orgId),
  }));
  expect(after.file).toBeNull();
  expect(after.org).toBeNull();
});

/**
 * `setImage` adopts an upload and later deletes it, and storage ids leak
 * through `storage.getUrl` URLs. Anyone who signs up owns a workspace, so
 * without a freshness and references check they could take another
 * workspace's logo and have it deleted. `convex-test` drops the blob type, so
 * the type is patched on, as `projects.test.ts` does.
 */
async function pngUpload(t: ReturnType<typeof harness>) {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["pretend png"]));
    const writer = ctx.db as unknown as {
      patch(id: Id<"_storage">, value: { contentType: string }): Promise<void>;
    };
    await writer.patch(id, { contentType: "image/png" });
    return id;
  });
}

test("a file another workspace shows as its logo is refused and kept", async () => {
  const t = harness();
  const { orgId: mine } = await workspace(t);
  const { orgId: theirs } = await t
    .withIdentity(BOB)
    .mutation(api.orgs.create, { name: "Other" });
  const logo = await pngUpload(t);
  await t.run((ctx) => ctx.db.patch(theirs, { imageId: logo }));

  await expect(
    t
      .withIdentity(ALICE)
      .mutation(api.orgs.setImage, { orgId: mine, storageId: logo }),
  ).rejects.toThrow(ConvexError);

  const after = await t.run(async (ctx) => ({
    file: await ctx.db.system.get(logo),
    theirs: await ctx.db.get(theirs),
    mine: await ctx.db.get(mine),
  }));
  expect(after.file).not.toBeNull();
  expect(after.theirs?.imageId).toBe(logo);
  expect(after.mine?.imageId).toBeUndefined();
});

test("a project screenshot is refused as a workspace picture", async () => {
  const t = harness();
  const { orgId: mine } = await workspace(t);
  const { orgId: theirs } = await t
    .withIdentity(BOB)
    .mutation(api.orgs.create, { name: "Other" });
  const shot = await pngUpload(t);
  await t.run(async (ctx) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", theirs))
      .unique();
    const sprintId = await ctx.db.insert("sprints", {
      orgId: theirs,
      teamId: team!._id,
      status: "draft",
      startDate: "2026-09-09",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: "AI Productivity Fundamentals",
      createdAt: 0,
    });
    const person = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", theirs))
      .first();
    await ctx.db.insert("projects", {
      orgId: theirs,
      personId: person!._id,
      sprintId,
      startedWeek: 1,
      title: "Draft the weekly update",
      before: "",
      change: "",
      after: "",
      resultTypes: [],
      humanReviewed: false,
      dataSafe: false,
      screenshotId: shot,
      status: "draft",
      sharing: "private",
      autosavedAt: 0,
    });
  });

  await expect(
    t
      .withIdentity(ALICE)
      .mutation(api.orgs.setImage, { orgId: mine, storageId: shot }),
  ).rejects.toThrow(ConvexError);
  expect(await t.run((ctx) => ctx.db.system.get(shot))).not.toBeNull();
});

test("a stale upload is refused, a fresh one adopted and re-saving it is a no-op", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const t = harness();
    const { orgId } = await workspace(t);
    const alice = t.withIdentity(ALICE);
    const old = await pngUpload(t);
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await expect(
      alice.mutation(api.orgs.setImage, { orgId, storageId: old }),
    ).rejects.toThrow(ConvexError);

    const fresh = await pngUpload(t);
    await alice.mutation(api.orgs.setImage, { orgId, storageId: fresh });
    // Past the window, the file the workspace already shows is still its own.
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await alice.mutation(api.orgs.setImage, { orgId, storageId: fresh });
    const after = await t.run(async (ctx) => ({
      file: await ctx.db.system.get(fresh),
      org: await ctx.db.get(orgId),
    }));
    expect(after.file).not.toBeNull();
    expect(after.org?.imageId).toBe(fresh);
  } finally {
    vi.useRealTimers();
  }
});
