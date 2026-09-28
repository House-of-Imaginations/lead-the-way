import { expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { PERMISSIONS } from "../../../convex/lib/orgs/permissions";
import { harness, seat, workspace } from "./helpers";

test("owners hold every permission without a migration", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const permissions = await owner.query(api.orgs.myPermissions, { orgId });
  expect([...permissions].sort()).toEqual([...PERMISSIONS].sort());
});

test("a role cannot grant what its creator does not hold", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as: admin } = await seat(t, orgId, "user_admin", ["roles:manage"]);
  await expect(
    admin.mutation(api.orgRoles.create, {
      orgId,
      name: "Manager",
      permissions: ["members:manage"],
    }),
  ).rejects.toMatchObject({ data: { code: "PERMISSION_ESCALATION" } });
});
