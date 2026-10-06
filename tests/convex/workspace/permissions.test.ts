import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { PERMISSIONS } from "../../../convex/lib/orgs/permissions";
import { harness, seat, workspace } from "./helpers";

test("owners hold every permission without a migration", async () => {
  const t = harness();
  const { owner } = await workspace(t);
  const permissions = await owner.query(api.orgs.myPermissions, {});
  expect([...permissions].sort()).toEqual([...PERMISSIONS].sort());
});

test("a role cannot grant what its creator does not hold", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as: admin } = await seat(t, orgId, "user_admin", ["roles:manage"]);
  await expect(
    admin.mutation(api.orgRoles.create, {
      name: "Manager",
      permissions: ["members:manage"],
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
});

test("a custom role with team:insights has it and cannot escalate", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const { as: lead, roleId } = await seat(t, orgId, "user_lead", [
    "team:insights",
    "roles:manage",
  ]);

  expect(await lead.query(api.orgs.myPermissions, {})).toEqual([
    "team:insights",
    "roles:manage",
  ]);
  // The owner holds both new permissions without a migration.
  expect(await owner.query(api.orgs.myPermissions, {})).toEqual(
    expect.arrayContaining(["sprint:manage", "team:insights"]),
  );

  // roles:manage is not a way to reach what the role doesn't hold, whether by
  // a new role or by widening its own.
  await expect(
    lead.mutation(api.orgRoles.create, {
      name: "Planner",
      permissions: ["sprint:manage"],
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
  await expect(
    lead.mutation(api.orgRoles.update, {
      roleId,
      name: "Lead",
      permissions: ["team:insights", "roles:manage", "members:manage"],
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });

  // team:insights is aggregates, not the member list.
  await expect(lead.query(api.members.list, {})).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });

  // It may hand out exactly what it holds.
  await expect(
    lead.mutation(api.orgRoles.create, {
      name: "Insights",
      permissions: ["team:insights"],
      expectOrgId: orgId,
    }),
  ).resolves.toBeDefined();
});
