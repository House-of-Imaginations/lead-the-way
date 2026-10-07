import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { harness, seat, workspace, type T } from "./helpers";

/** The Roles editor's server rules (R-a). The escalation set is in orgs.test.ts. */
const FORBIDDEN = { data: { code: "FORBIDDEN" } };
const NAME = { data: { code: "FIELD_REQUIRED" } };

const roleId = async (as: ReturnType<T["withIdentity"]>, name: string) =>
  (await as.query(api.orgRoles.list, {})).find((r) => r.name === name)!._id;

test("role names are unique, whatever the case (R-a)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const make = (name: string) =>
    owner.mutation(api.orgRoles.create, {
      name,
      permissions: [],
      expectOrgId: orgId,
    });
  const coordinator = await make("Coordinator");
  await expect(make(" coordinator ")).rejects.toMatchObject(NAME);
  // The owner role's name is taken too.
  await expect(make("MANAGER")).rejects.toMatchObject(NAME);

  const spare = await make("Spare");
  await expect(
    owner.mutation(api.orgRoles.update, {
      roleId: spare,
      name: "COORDINATOR",
      permissions: [],
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(NAME);
  // Keeping your own name, or changing its case, is not a clash.
  await owner.mutation(api.orgRoles.update, {
    roleId: coordinator,
    name: "coordinator",
    permissions: ["team:insights"],
    expectOrgId: orgId,
  });
});

test("saving a role keeps the members:read the editor never shows (M-e)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const reader = await owner.mutation(api.orgRoles.create, {
    name: "Reader",
    permissions: ["members:read", "team:insights"],
    expectOrgId: orgId,
  });
  await owner.mutation(api.orgRoles.update, {
    roleId: reader,
    name: "Reader",
    permissions: ["sprint:manage"],
    expectOrgId: orgId,
  });
  const stored = await t.run((ctx) => ctx.db.get(reader));
  expect(stored).toMatchObject({
    permissions: ["sprint:manage", "members:read"],
  });
});

test("nobody edits the role they hold (R-a)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const { as: admin, roleId: own } = await seat(t, orgId, "user_admin", [
    "roles:manage",
    "team:insights",
  ]);
  // Narrowing or renaming your own role: refused, not escalation.
  await expect(
    admin.mutation(api.orgRoles.update, {
      roleId: own,
      name: "Renamed",
      permissions: ["roles:manage"],
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(FORBIDDEN);
  // Widening it still reads as escalation (orgs.test.ts pins those).
  await expect(
    admin.mutation(api.orgRoles.update, {
      roleId: own,
      name: "Renamed",
      permissions: ["roles:manage", "team:insights", "org:manage"],
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
  // Somebody else may.
  await owner.mutation(api.orgRoles.update, {
    roleId: own,
    name: "Renamed",
    permissions: ["roles:manage"],
    expectOrgId: orgId,
  });
});

test("the role your team is invited into keeps no permissions and stays (R-a)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const employee: Id<"orgRoles"> = await roleId(owner, "Employee");
  // Renaming is fine. Protection follows pickInviteRole's pick, and with no
  // other role named "Employee" the renamed role is still the pick.
  await owner.mutation(api.orgRoles.update, {
    roleId: employee,
    name: "Teammate",
    permissions: [],
    expectOrgId: orgId,
  });
  await expect(
    owner.mutation(api.orgRoles.update, {
      roleId: employee,
      name: "Teammate",
      permissions: ["team:insights"],
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(FORBIDDEN);
  // It is the last role with no permissions, and it stays.
  await expect(
    owner.mutation(api.orgRoles.remove, {
      roleId: employee,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(FORBIDDEN);

  // Another role with no permissions is an ordinary role.
  const contractor = await owner.mutation(api.orgRoles.create, {
    name: "Contractor",
    permissions: [],
    expectOrgId: orgId,
  });
  await owner.mutation(api.orgRoles.update, {
    roleId: contractor,
    name: "Contractor",
    permissions: ["team:insights"],
    expectOrgId: orgId,
  });
  await owner.mutation(api.orgRoles.remove, {
    roleId: contractor,
    expectOrgId: orgId,
  });
  // And the team is still invited into the renamed one.
  expect(
    (await owner.query(api.orgRoles.list, {})).find((r) => r.launch)?._id,
  ).toBe(employee);
});
