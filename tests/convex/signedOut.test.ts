/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import http from "../../convex/http";
import { personFields } from "./testHelpers";
import { harness, type T } from "./workspace/helpers";

/**
 * TENANT ISOLATION STARTS AT SIGN-IN. Every public function refuses a
 * signed-out caller with NOT_SIGNED_IN, except the few in `SIGNED_OUT`. A new
 * public function fails this file until it is added to `callsFor` (and
 * refuses) or to `SIGNED_OUT` (with the reason next to it).
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
type Fn = { name: string; kind: Kind };

function publicFunctions(): Fn[] {
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

function call(t: T, fn: Fn, args: Record<string, unknown>) {
  if (fn.kind === "query") {
    return t.query(makeFunctionReference<"query">(fn.name), args);
  }
  if (fn.kind === "mutation") {
    return t.mutation(makeFunctionReference<"mutation">(fn.name), args);
  }
  return t.action(makeFunctionReference<"action">(fn.name), args);
}

/** These answer signed out, on purpose. Each says why, and what it answers. */
const SIGNED_OUT: Record<
  string,
  { args: Record<string, unknown>; answer: unknown }
> = {
  // The landing page reads flags before sign-in.
  "app:flag": { args: { flag: "demo" }, answer: false },
  // Null when signed out.
  "auth:getCurrentUser": { args: {}, answer: null },
  // The log-in page lists its buttons.
  "authMethods:enabled": { args: {}, answer: ["google"] },
  // "Start as Priya" on /guide signs in from nothing. Null: DEMO_MODE is off here.
  "demo:personaPassword": { args: {}, answer: null },
  // Null when signed out.
  "profiles:me": { args: {}, answer: null },
  // The invitation page, before sign-up: what the link invites to, no address.
  "invites:publicPreview": {
    args: { token: "tok" },
    answer: {
      orgName: "Aster Network",
      orgImageUrl: null,
      emailPinned: false,
      invitedBy: "Someone",
      name: null,
      message: null,
    },
  },
};

type Ids = {
  orgId: Id<"orgs">;
  roleId: Id<"orgRoles">;
  personId: Id<"people">;
  inviteId: Id<"orgInvites">;
  storageId: Id<"_storage">;
};

/** Real ids, so argument validation passes and the auth check is what answers. */
async function fixtures(t: T): Promise<Ids> {
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

const callsFor = ({
  orgId,
  roleId,
  personId,
  inviteId,
  storageId,
}: Ids): Record<string, Record<string, unknown>> => ({
  "demo:reset": { expectOrgId: orgId },
  "demo:setClock": { target: "week1", expectOrgId: orgId },
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

afterEach(() => {
  vi.unstubAllEnvs();
});

test("every public function refuses a signed-out caller unless it is listed", async () => {
  const t = harness();
  const calls = callsFor(await fixtures(t));
  const unlisted: string[] = [];
  const answered: string[] = [];
  for (const fn of publicFunctions()) {
    if (fn.name in SIGNED_OUT) continue;
    const args = calls[fn.name];
    if (!args) {
      unlisted.push(fn.name);
      continue;
    }
    const error = await call(t, fn, args).then(
      () => null,
      (e: unknown) => e,
    );
    const code = (error as { data?: { code?: string } } | null)?.data?.code;
    if (code !== "NOT_SIGNED_IN") answered.push(`${fn.name} (${code ?? "ok"})`);
  }
  expect(unlisted).toEqual([]);
  expect(answered).toEqual([]);
  // A listed name that no longer exists would pass silently; refuse it too.
  const names = new Set(publicFunctions().map((fn) => fn.name));
  expect(Object.keys(calls).filter((name) => !names.has(name))).toEqual([]);
});

test("HTTP serves only the routes Better Auth mounts", () => {
  // The sweep above sees functions, not routes. A new route fails here until
  // somebody has checked what it answers signed out, then listed it.
  const routes = http
    .getRoutes()
    .map(([path, method]) => `${method} ${path}`)
    .sort();
  expect(routes).toEqual([
    "GET /.well-known/openid-configuration",
    "GET /api/auth/*",
    "POST /api/auth/*",
  ]);
});

test("the signed-out allowlist answers without an account", async () => {
  // Pin the env the answers depend on, so a developer's shell cannot move them.
  vi.stubEnv("DEMO_MODE", "");
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-secret");
  vi.stubEnv("GITHUB_CLIENT_ID", "");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "");
  vi.stubEnv("DISCORD_CLIENT_ID", "");
  vi.stubEnv("DISCORD_CLIENT_SECRET", "");
  const t = harness();
  await fixtures(t);
  const all = publicFunctions();
  for (const [name, { args, answer }] of Object.entries(SIGNED_OUT)) {
    const fn = all.find((f) => f.name === name);
    expect(fn, name).toBeDefined();
    expect(await call(t, fn!, args), name).toEqual(answer);
  }
});
