import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { ALL_PERMISSIONS } from "../../../convex/lib/orgs/permissions";
import { harness, seat, workspace } from "./helpers";

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
