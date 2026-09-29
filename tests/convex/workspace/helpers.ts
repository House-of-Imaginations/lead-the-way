/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Permission } from "../../../convex/lib/orgs/permissions";
import schema from "../../../convex/schema";
import { personFields, registerComponents } from "../testHelpers";

export const modules = import.meta.glob("../../../convex/**/*.ts");

export function harness() {
  const t = convexTest(schema, modules);
  registerComponents(t);
  return t;
}
export type T = ReturnType<typeof harness>;

export const OWNER = { subject: "user_owner" };

/** The owner makes a workspace. Owner resolves to every permission. */
export async function workspace(t: T, name = "Aster Network") {
  const owner = t.withIdentity(OWNER);
  const { orgId, slug } = await owner.mutation(api.orgs.create, { name });
  return { owner, orgId, slug };
}

/** A custom role holding exactly `permissions`, and `subject` seated on it. */
export async function seat(
  t: T,
  orgId: Id<"orgs">,
  subject: string,
  permissions: Permission[],
) {
  const { personId, roleId } = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: `role-${subject}`,
      permissions,
      createdAt: Date.now(),
    });
    const personId = await ctx.db.insert("people", {
      orgId,
      roleId,
      ...personFields(subject),
    });
    return { personId, roleId };
  });
  return { as: t.withIdentity({ subject }), personId, roleId };
}
