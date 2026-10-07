import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import {
  HIDDEN_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_CLASS,
  PERMISSION_LABELS,
  ROLE_EDITOR_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
  isManager,
} from "../../../convex/lib/orgs/permissions";
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

test("every permission is a manager's or a teammate's, and isManager agrees", () => {
  for (const p of PERMISSIONS) {
    expect(["manager", "teammate"], p).toContain(PERMISSION_CLASS[p]);
    expect(isManager({ permissions: [p] }), p).toBe(
      PERMISSION_CLASS[p] === "manager",
    );
  }
  // W-f: workspace control is a manager's. M-e: members:read alone is not.
  for (const p of WORKSPACE_PERMISSIONS) {
    expect(PERMISSION_CLASS[p], p).toBe("manager");
  }
  expect(PERMISSION_CLASS["members:read"]).toBe("teammate");
});

test("the role editor offers M-i's labels and hides members:read (M-e)", () => {
  expect(ROLE_EDITOR_PERMISSIONS.map((p) => PERMISSION_LABELS[p])).toEqual([
    "Change workspace settings",
    "Invite and remove people",
    "Create and edit roles",
    "Set up and run the sprint",
    "See team totals",
  ]);
  expect(HIDDEN_PERMISSIONS).toEqual(["members:read"]);
});

test("only an owner deletes a workspace, whatever a custom role holds (M-j)", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as: all } = await seat(t, orgId, "user_all", [...PERMISSIONS]);
  await expect(
    all.mutation(api.orgs.remove, { expectOrgId: orgId }),
  ).rejects.toMatchObject({
    data: {
      code: "FORBIDDEN",
      message: "Only an owner can delete a workspace.",
    },
  });
});
