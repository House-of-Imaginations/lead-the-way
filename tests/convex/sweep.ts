/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { personFields } from "./testHelpers";
import type { T } from "./workspace/helpers";

/**
 * The table both sweeps run from: `signedOut.test.ts` (every public function
 * refuses a signed-out caller) and `tenant.test.ts` (no public function reads
 * another workspace's ids). One table, so a new function can't join one sweep
 * and miss the other. Add each new public function to `callsFor`.
 */
const modules = import.meta.glob(
  [
    "../../convex/**/*.ts",
    "!../../convex/_generated/**",
    "!../../convex/**/*.config.ts",
  ],
  { eager: true },
) as Record<string, Record<string, unknown>>;

type Kind = "query" | "mutation" | "action";
export type Fn = { name: string; kind: Kind };

export function publicFunctions(): Fn[] {
  const found: Fn[] = [];
  for (const [path, exports] of Object.entries(modules)) {
    const file = path.replace("../../convex/", "").replace(/\.ts$/, "");
    for (const [name, value] of Object.entries(exports)) {
      const fn = value as {
        isPublic?: boolean;
        isQuery?: boolean;
        isMutation?: boolean;
      } | null;
      if (!fn?.isPublic) continue;
      const kind = fn.isQuery ? "query" : fn.isMutation ? "mutation" : "action";
      found.push({ name: `${file}:${name}`, kind });
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** Call a public function by name, signed out (`t`) or as someone (`t.withIdentity`). */
export function call(
  t: Pick<T, "query" | "mutation" | "action">,
  fn: Fn,
  args: Record<string, unknown>,
) {
  if (fn.kind === "query") {
    return t.query(makeFunctionReference<"query">(fn.name), args);
  }
  if (fn.kind === "mutation") {
    return t.mutation(makeFunctionReference<"mutation">(fn.name), args);
  }
  return t.action(makeFunctionReference<"action">(fn.name), args);
}

export type Ids = {
  orgId: Id<"orgs">;
  roleId: Id<"orgRoles">;
  personId: Id<"people">;
  inviteId: Id<"orgInvites">;
  storageId: Id<"_storage">;
};

/** Real ids, so argument validation passes and the auth check is what answers. */
export async function fixtures(t: T): Promise<Ids> {
  return await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", {
      name: "Aster Network",
      slug: "aster-network",
      privacyThreshold: 5,
      isDemo: false,
      createdAt: 0,
    });
    const roleId = await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Employee",
      permissions: [],
      createdAt: 0,
    });
    const personId = await ctx.db.insert("people", {
      orgId,
      roleId,
      ...personFields("user_x"),
    });
    const inviteId = await ctx.db.insert("orgInvites", {
      orgId,
      roleId,
      token: "tok",
      status: "pending",
      invitedBy: "user_x",
      expiresAt: Date.now() + 60_000,
      createdAt: 0,
    });
    const storageId = await ctx.storage.store(new Blob(["x"]));
    return { orgId, roleId, personId, inviteId, storageId };
  });
}

export const callsFor = ({
  orgId,
  roleId,
  personId,
  inviteId,
  storageId,
}: Ids): Record<string, Record<string, unknown>> => ({
  "demo:personaPassword": {},
  "demo:reset": { expectOrgId: orgId },
  "demo:setClock": { target: "week1", expectOrgId: orgId },
  "onboarding:start": { acceptTerms: true },
  "orgs:active": {},
  "orgs:bySlug": { slug: "aster-network" },
  "orgs:create": { name: "Aster Network" },
  "orgs:mine": {},
  "orgs:rename": { orgId, name: "Aster" },
  "orgs:generateImageUploadUrl": { orgId },
  "orgs:setImage": { orgId, storageId },
  "orgs:clearImage": { orgId },
  "orgs:remove": { orgId },
  "orgs:myPermissions": { orgId },
  "orgRoles:list": { orgId },
  "orgRoles:create": { orgId, name: "Lead", permissions: [] },
  "orgRoles:update": { orgId, roleId, name: "Lead", permissions: [] },
  "orgRoles:remove": { orgId, roleId },
  "members:list": { orgId },
  "members:changeRole": { orgId, personId, roleId },
  "members:remove": { orgId, personId },
  "members:leave": { orgId },
  "invites:list": { orgId },
  "invites:create": { orgId, roleId },
  "invites:resend": { orgId, inviteId },
  "invites:revoke": { orgId, inviteId },
  "invites:preview": { token: "tok" },
  "invites:accept": { token: "tok" },
  "invites:decline": { token: "tok" },
  "profiles:saveProfile": { displayName: "Pat" },
  "profiles:setActiveOrg": { orgId },
});
