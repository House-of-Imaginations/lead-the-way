import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Permission } from "../../../convex/lib/orgs/permissions";
import { inviteRoleOf, pickInviteRole } from "../../../convex/lib/orgs/invites";
import { harness, seat, workspace, type T } from "./helpers";

/** The Roles editor's server rules (R-a). The escalation set is in orgs.test.ts. */
// Task 7's modal shows these as they are, so the words are pinned too.
const NAME = {
  data: {
    code: "FIELD_REQUIRED",
    message: "Another role already has that name.",
  },
};
const OWN_ROLE = {
  data: {
    code: "FORBIDDEN",
    message: "You can't edit your own role. Ask someone else to change it.",
  },
};
const NO_PERMISSIONS = {
  data: {
    code: "FORBIDDEN",
    message:
      "Your team is invited into this role, so it can't have permissions.",
  },
};
const STAYS = {
  data: {
    code: "FORBIDDEN",
    message: "Your team is invited into this role, so it can't be deleted.",
  },
};

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
  ).rejects.toMatchObject(OWN_ROLE);
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
  // Renaming is fine: protection follows the stored launch role (G-g).
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
  ).rejects.toMatchObject(NO_PERMISSIONS);
  // It is the last role with no permissions, and it stays.
  await expect(
    owner.mutation(api.orgRoles.remove, {
      roleId: employee,
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject(STAYS);

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

// G-g: a new bare "Employee" never takes the launch role over.
test("the stored launch role keeps its protection after a rename (G-g)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const update = (
    id: Id<"orgRoles">,
    name: string,
    permissions: Permission[],
  ) =>
    owner.mutation(api.orgRoles.update, {
      roleId: id,
      name,
      permissions,
      expectOrgId: orgId,
    });
  const team = await roleId(owner, "Employee");
  await update(team, "Team", []);
  const newcomer = await owner.mutation(api.orgRoles.create, {
    name: "Employee",
    permissions: [],
    expectOrgId: orgId,
  });
  expect((await t.run((ctx) => inviteRoleOf(ctx, orgId)))._id).toBe(team);

  await expect(update(team, "Team", ["team:insights"])).rejects.toMatchObject(
    NO_PERMISSIONS,
  );
  await expect(
    owner.mutation(api.orgRoles.remove, { roleId: team, expectOrgId: orgId }),
  ).rejects.toMatchObject(STAYS);
  await update(newcomer, "Employee", ["team:insights"]);
  await owner.mutation(api.orgRoles.remove, {
    roleId: newcomer,
    expectOrgId: orgId,
  });
  expect(
    (await owner.query(api.orgRoles.list, {})).find((r) => r.launch)?._id,
  ).toBe(team);
});

test("a workspace from before P9 still follows the name guess", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await t.run((ctx) => ctx.db.patch(orgId, { inviteRoleId: undefined }));
  const update = (
    id: Id<"orgRoles">,
    name: string,
    permissions: Permission[],
  ) =>
    owner.mutation(api.orgRoles.update, {
      roleId: id,
      name,
      permissions,
      expectOrgId: orgId,
    });
  const teammate = await roleId(owner, "Employee");
  await update(teammate, "Teammate", []);
  const contractor = await owner.mutation(api.orgRoles.create, {
    name: "Contractor",
    permissions: [],
    expectOrgId: orgId,
  });
  await update(contractor, "Employee", []);
  // The guess picks the new "Employee", so it is the protected one.
  await expect(
    update(contractor, "Employee", ["team:insights"]),
  ).rejects.toMatchObject(NO_PERMISSIONS);
  await update(teammate, "Teammate", ["team:insights"]);
});

test("a stored launch role that grants anything is never picked", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const picked = await t.run(async (ctx) => {
    const org = (await ctx.db.get(orgId))!;
    // R-a refuses this through the app; write it directly to prove the read fails closed.
    await ctx.db.patch(org.inviteRoleId!, { permissions: ["team:insights"] });
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return pickInviteRole(org, roles);
  });
  expect(picked).toBeNull();
});

test("keeping a role's own name is never a clash, even beside an old duplicate (M-10)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  // Two rows with one name, as written before names were unique.
  const [first] = await t.run(async (ctx) =>
    Promise.all(
      ["Coordinator", "coordinator"].map((name) =>
        ctx.db.insert("orgRoles", {
          orgId,
          kind: "custom",
          name,
          permissions: ["team:insights"],
          createdAt: Date.now(),
        }),
      ),
    ),
  );
  await owner.mutation(api.orgRoles.update, {
    roleId: first,
    name: "COORDINATOR",
    permissions: ["team:insights"],
    expectOrgId: orgId,
  });
});
