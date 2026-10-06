import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import { ALL_PERMISSIONS } from "../../../convex/lib/orgs/permissions";
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
    "email",
    "isOwner",
    "joinedAt",
    "name",
    "personId",
    "roleId",
    "roleName",
    "userId",
    "you",
  ]);
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
