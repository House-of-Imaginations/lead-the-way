import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { castOf } from "../../../convex/lib/demo/cast";
import { ON_REMOVE } from "../../../convex/lib/orgs/cascade";
import { ALL_PERMISSIONS } from "../../../convex/lib/orgs/permissions";
import { writeSettings } from "../../../convex/lib/settings";
import { calderLane, harness, seat, workspace } from "./helpers";

/**
 * 18's Members tab and the writes behind it: who may read it (G1), who may
 * touch the owner role (M-b), and what a removal leaves behind (M-c).
 */
beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const FORBIDDEN = { data: { code: "FORBIDDEN" } };

test("only an owner moves anybody into or out of the owner role (M-b)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  // All six permissions pass requireWithin and requireOutranks on their own.
  const six = await seat(t, orgId, "user_six", [...ALL_PERMISSIONS]);
  const ownerRole = (await owner.query(api.orgRoles.list, {})).find(
    (r) => r.isOwner,
  )!._id;
  const ownerSeat = (await owner.query(api.members.list, {})).find(
    (m) => m.isOwner,
  )!.personId;

  // Promote itself, demote the owner, or remove the owner: all refused.
  await expect(
    six.as.mutation(api.members.changeRole, {
      personId: six.personId,
      roleId: ownerRole,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(FORBIDDEN);
  await expect(
    six.as.mutation(api.members.changeRole, {
      personId: ownerSeat,
      roleId: six.roleId,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(FORBIDDEN);
  await expect(
    six.as.mutation(api.members.remove, {
      personId: ownerSeat,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(FORBIDDEN);

  // An owner may hand the role over, and the new owner may act on owners.
  await owner.mutation(api.members.changeRole, {
    personId: six.personId,
    roleId: ownerRole,
    expectOrgId: orgId,
  });
  await six.as.mutation(api.members.changeRole, {
    personId: ownerSeat,
    roleId: six.roleId,
    expectOrgId: orgId,
  });
  const after = await six.as.query(api.members.list, {});
  expect(after.find((m) => m.personId === ownerSeat)?.isOwner).toBe(false);
  expect(after.find((m) => m.personId === six.personId)?.isOwner).toBe(true);
});

test("the Members reads open to their W-g holders and nobody else (G1)", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const people = await seat(t, orgId, "user_people", ["members:manage"]);
  const reader = await seat(t, orgId, "user_reader", ["members:read"]);
  const roles = await seat(t, orgId, "user_roles", ["roles:manage"]);
  const lead = await seat(t, orgId, "user_lead", ["team:insights"]);

  // Members needs members:manage (W-g), so all three of its reads load. The
  // owner and four seats; Manager, Employee and the four seats' roles.
  expect(await people.as.query(api.members.list, {})).toHaveLength(5);
  expect(await people.as.query(api.orgRoles.list, {})).toHaveLength(6);
  expect(await people.as.query(api.invites.list, {})).toEqual([]);
  // members:read stays in code and still reads the list (M-e), never the tokens.
  expect(await reader.as.query(api.members.list, {})).toHaveLength(5);
  expect(await reader.as.query(api.orgRoles.list, {})).toHaveLength(6);
  await expect(reader.as.query(api.invites.list, {})).rejects.toMatchObject(
    FORBIDDEN,
  );
  // roles:manage reads the roles (P7b-3b's tab), not the people.
  expect(await roles.as.query(api.orgRoles.list, {})).toHaveLength(6);
  await expect(roles.as.query(api.members.list, {})).rejects.toMatchObject(
    FORBIDDEN,
  );
  // team:insights is aggregates only.
  await expect(lead.as.query(api.members.list, {})).rejects.toMatchObject(
    FORBIDDEN,
  );
  await expect(lead.as.query(api.orgRoles.list, {})).rejects.toMatchObject(
    FORBIDDEN,
  );
  await expect(lead.as.query(api.invites.list, {})).rejects.toMatchObject(
    FORBIDDEN,
  );
});

test("the member list is name, email and role, and marks your own row", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await seat(t, orgId, "user_dee", []);
  const rows = await owner.query(api.members.list, {});
  expect(rows.map((r) => r.you)).toEqual([true, false]);
  // Privacy rule 7: nothing about anyone's participation, ever.
  expect(Object.keys(rows[0]).sort()).toEqual([
    "canManage",
    "email",
    "isOwner",
    "joinedAt",
    "name",
    "orgId",
    "personId",
    "roleId",
    "roleName",
    "userId",
    "you",
  ]);
});

test("each Members read names the workspace it read, for 18's switch check", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await owner.mutation(api.invites.create, {
    roleId: (await owner.query(api.orgRoles.list, {})).find((r) => !r.isOwner)!
      ._id,
    email: "dee@example.com",
    expectOrgId: orgId,
  });
  const reads = [
    await owner.query(api.members.list, {}),
    await owner.query(api.invites.list, {}),
    await owner.query(api.orgRoles.list, {}),
  ];
  for (const rows of reads) {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => (r as { orgId?: string }).orgId)).toEqual(
      rows.map(() => orgId),
    );
  }
});

test("Invite member pins the newest sprint, so sprint 1 counts it (M-g)", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week2" });
  const priya = as("priya");
  const employee = (await priya.query(api.orgRoles.list, {})).find(
    (r) => r.name === "Employee",
  )!._id;
  await priya.mutation(api.invites.create, {
    roleId: employee,
    email: "new.hire@example.com",
    expectOrgId: orgId,
  });
  expect((await priya.query(api.manager.overview, {}))!.sprint).toMatchObject({
    invited: 9,
    joined: 7,
  });
});

test("Invite member leaves a finished sprint's headcount alone (M-g)", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "complete" });
  const priya = as("priya");
  const invited = async () => {
    const outcomes = (await priya.query(api.manager.outcomes, {}))!;
    return "participation" in outcomes ? outcomes.participation.invited : -1;
  };
  const before = await invited();
  expect(before).toBeGreaterThan(0);
  const employee = (await priya.query(api.orgRoles.list, {})).find(
    (r) => r.name === "Employee",
  )!._id;
  await priya.mutation(api.invites.create, {
    roleId: employee,
    email: "late.hire@example.com",
    expectOrgId: orgId,
  });
  expect(await invited()).toBe(before);
});

test("Invite member pins only team members, never a manager role (M-g, W-f)", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week2" });
  const priya = as("priya");
  const insights = await seat(t, orgId, "user_lead2", ["team:insights"]);
  const admin = await seat(t, orgId, "user_admin2", ["org:manage"]);
  const employee = (await priya.query(api.orgRoles.list, {})).find(
    (r) => r.name === "Employee",
  )!._id;
  const invited = async () =>
    (await priya.query(api.manager.overview, {}))!.sprint!.invited;
  const invite = async (roleId: Id<"orgRoles">, email: string) => {
    await priya.mutation(api.invites.create, {
      roleId,
      email,
      expectOrgId: orgId,
    });
    return await invited();
  };
  const base = await invited();
  expect(await invite(insights.roleId, "lead@example.com")).toBe(base);
  expect(await invite(admin.roleId, "admin@example.com")).toBe(base);
  expect(await invite(employee, "hire@example.com")).toBe(base + 1);
});

test("a named sprint keeps the same pin rules (M-g)", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week2" });
  const priya = as("priya");
  const sprintId = await t.run(
    async (ctx) =>
      (await ctx.db
        .query("sprints")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first())!._id,
  );
  const insights = await seat(t, orgId, "user_lead3", ["team:insights"]);
  const invited = async () =>
    (await priya.query(api.manager.overview, {}))!.sprint!.invited;
  const base = await invited();
  await priya.mutation(api.invites.create, {
    roleId: insights.roleId,
    email: "lead@example.com",
    sprintId,
    expectOrgId: orgId,
  });
  expect(await invited()).toBe(base);

  await t.mutation(internal.seed.clock, { target: "complete" });
  const employee = (await priya.query(api.orgRoles.list, {})).find(
    (r) => r.name === "Employee",
  )!._id;
  await expect(
    priya.mutation(api.invites.create, {
      roleId: employee,
      email: "late@example.com",
      sprintId,
      expectOrgId: orgId,
    }),
  ).rejects.toThrow("That sprint has finished.");
});

type Lane = Awaited<ReturnType<typeof calderLane>>;

async function personOf(t: Lane["t"], orgId: Id<"orgs">, key: "dan" | "sarah") {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

/**
 * Whether any row of each `ON_REMOVE` table still holds `personId`, in any
 * field (the tables differ in where, and two keep it in an array). Walking
 * the map itself means it and `dropSeat` can't drift apart unnoticed.
 */
async function rowsOf(t: Lane["t"], personId: Id<"people">) {
  return await t.run(async (ctx) => {
    const held: Record<string, boolean> = {};
    for (const table of Object.keys(ON_REMOVE) as (keyof typeof ON_REMOVE)[]) {
      const rows = await ctx.db.query(table).collect();
      held[table] = rows.some((r) => JSON.stringify(r).includes(personId));
    }
    return held;
  });
}

test("removing a member drops only the dropped tables' rows (M-c)", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "complete" });
  const dan = await personOf(t, orgId, "dan");
  // Dan finished (badge, project, progress). Give him a settings row and a
  // reminder sent, the two tables a removal deletes.
  await t.run(async (ctx) => {
    const sprint = (await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first())!;
    // The one settings writer upserts, so this never makes a second row.
    await writeSettings(ctx, { _id: dan, orgId }, { reduceMotion: true });
    await ctx.db.insert("reminders", {
      orgId,
      sprintId: sprint._id,
      personId: dan,
      week: 1,
      kind: "weekly",
      at: 0,
      emailed: false,
    });
  });
  const before = await rowsOf(t, dan);
  // The two a removal deletes, and three it keeps, are all filled for Dan.
  for (const table of [
    "settings",
    "reminders",
    "badges",
    "projects",
    "learningProgress",
  ]) {
    expect(before[table], table).toBe(true);
  }

  await as("priya").mutation(api.members.remove, {
    personId: dan,
    expectOrgId: orgId,
  });
  const after = await rowsOf(t, dan);
  for (const [table, left] of Object.entries(after)) {
    expect(left, table).toBe(
      ON_REMOVE[table as keyof typeof ON_REMOVE] === "kept" && before[table]!,
    );
  }
});

test("a removed member's credential link still opens, without the reflection (M-c)", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "complete" });
  // Signed out, as the public page reads it.
  const read = () =>
    t.query(api.badges.publicBySlug, { slug: "dan-okafor-ai-fundamentals" });
  const before = await read();
  expect(before?.reflection).not.toBeNull();

  await as("priya").mutation(api.members.remove, {
    personId: await personOf(t, orgId, "dan"),
    expectOrgId: orgId,
  });
  // Name, badge and date from what was stored at issue; the reflection goes
  // with the seat, since nobody can turn it off any more.
  expect(await read()).toEqual({ ...before, reflection: null });
});

test("a removed member leaves sprint 1's joined count and Members (M-c)", async () => {
  const { t, orgId, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week2" });
  const priya = as("priya");
  await priya.mutation(api.members.remove, {
    personId: await personOf(t, orgId, "sarah"),
    expectOrgId: orgId,
  });
  // Off the seated team, so out of joined and invited alike (R-c).
  expect((await priya.query(api.manager.overview, {}))!.sprint).toMatchObject({
    invited: 7,
    joined: 6,
  });
  expect(
    (await priya.query(api.members.list, {})).map((m) => m.name),
  ).not.toContain("Sarah Whitlock");
});

test("the holder backfill stamps older badges once", async () => {
  const { t, orgId } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "complete" });
  // As badges issued before issueBadge stored the holder.
  const issued = await t.run(async (ctx) => {
    const badges = await ctx.db
      .query("badges")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const b of badges) {
      await ctx.db.patch(b._id, {
        holderName: undefined,
        holderTimeZone: undefined,
      });
    }
    return badges.length;
  });
  expect(issued).toBeGreaterThan(0);
  expect(await t.mutation(internal.badges.backfillHolders, {})).toBe(issued);
  expect(await t.mutation(internal.badges.backfillHolders, {})).toBe(0);
  const dan = await personOf(t, orgId, "dan");
  const { badge, person } = await t.run(async (ctx) => ({
    badge: await ctx.db
      .query("badges")
      .withIndex("by_person", (q) => q.eq("personId", dan))
      .unique(),
    person: (await ctx.db.get(dan))!,
  }));
  expect(badge).toMatchObject({
    holderName: person.name,
    holderTimeZone: person.timeZone,
  });
});

test("each row says whether this seat may change it, as the server decides", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const admin = await seat(t, orgId, "user_admin", ["members:manage"]);
  await seat(t, orgId, "user_dee", []);
  await seat(t, orgId, "user_big", ["members:manage", "org:manage"]);
  const reader = await seat(t, orgId, "user_reader", ["members:read"]);
  const manageable = async (as: typeof owner) =>
    Object.fromEntries(
      (await as.query(api.members.list, {})).map((r) => [
        r.userId,
        r.canManage,
      ]),
    );

  expect(await manageable(owner)).toEqual({
    user_owner: false, // you
    user_admin: true,
    user_dee: true,
    user_big: true,
    user_reader: true,
  });
  expect(await manageable(admin.as)).toEqual({
    user_owner: false, // the owner role (M-b)
    user_admin: false, // you
    user_dee: true,
    user_big: false, // reaches further
    user_reader: false, // members:read is not within members:manage
  });
  // members:read reads the list (M-e) and may change nobody.
  expect(Object.values(await manageable(reader.as))).not.toContain(true);

  // The flag is the server's own answer: every row it marks false is refused.
  for (const row of await admin.as.query(api.members.list, {})) {
    if (row.canManage || row.you) continue;
    await expect(
      admin.as.mutation(api.members.remove, {
        personId: row.personId,
        expectOrgId: orgId,
      }),
    ).rejects.toBeDefined();
  }
});

test("each role says what this seat may do with it", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const admin = await seat(t, orgId, "user_admin", [
    "members:manage",
    "roles:manage",
  ]);
  await seat(t, orgId, "user_dee", []);
  const reader = await seat(t, orgId, "user_reader", ["members:read"]);
  await owner.mutation(api.orgRoles.create, {
    name: "Spare",
    permissions: [],
    expectOrgId: orgId,
  });
  // [holders, launch, makesManager, assignable, editable, deletable]
  const flags = async (as: typeof owner) =>
    Object.fromEntries(
      (await as.query(api.orgRoles.list, {})).map((r) => [
        r.name,
        [
          r.holders,
          r.launch,
          r.makesManager,
          r.assignable,
          r.editable,
          r.deletable,
        ],
      ]),
    );

  expect(await flags(owner)).toEqual({
    Manager: [1, false, true, true, false, false],
    // Launch invites into it: never deletable (R-a).
    Employee: [0, true, false, true, true, false],
    "role-user_admin": [1, false, true, true, true, false],
    "role-user_dee": [1, false, false, true, true, false],
    "role-user_reader": [1, false, false, true, true, false],
    Spare: [0, false, false, true, true, true],
  });
  expect(await flags(admin.as)).toEqual({
    // Only an owner hands out the owner role (M-b); nobody edits it.
    Manager: [1, false, true, false, false, false],
    Employee: [0, true, false, true, true, false],
    // Your own role: you may give it, never edit it (R-a).
    "role-user_admin": [1, false, true, true, false, false],
    "role-user_dee": [1, false, false, true, true, false],
    // members:read is outside this seat's reach.
    "role-user_reader": [1, false, false, false, false, false],
    Spare: [0, false, false, true, true, true],
  });
  // members:read reads the roles and may do nothing with them.
  for (const row of Object.values(await flags(reader.as))) {
    expect(row.slice(3)).toEqual([false, false, false]);
  }
});
