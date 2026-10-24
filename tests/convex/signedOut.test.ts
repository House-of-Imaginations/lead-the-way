import { afterEach, expect, test, vi } from "vitest";
import http from "../../convex/http";
import { call, callsFor, fixtures, publicFunctions } from "./sweep";
import { harness } from "./workspace/helpers";

/**
 * TENANT ISOLATION STARTS AT SIGN-IN. Every public function refuses a
 * signed-out caller with NOT_SIGNED_IN, except the few in `SIGNED_OUT`. A new
 * public function fails this file until it is added to `callsFor` (and
 * refuses) or to `SIGNED_OUT` (with the reason next to it).
 */

/** These answer signed out, on purpose. Each says why, and what it answers. */
const SIGNED_OUT: Record<
  string,
  { args: Record<string, unknown>; answer: unknown }
> = {
  // Null when signed out.
  "auth:getCurrentUser": { args: {}, answer: null },
  // The log-in page lists its buttons.
  "authMethods:enabled": { args: {}, answer: ["google"] },
  // Null when signed out.
  "profiles:me": { args: {}, answer: null },
  // The proxy only sees a cookie; the layouts ask where the person belongs.
  "viewer:home": { args: {}, answer: null },
  // Null when signed out.
  "viewer:shell": { args: {}, answer: null },
  // The invitation page, before sign-up: what the link invites to, and the pinned address on a pending link.
  "invites:publicPreview": {
    args: { token: "tok" },
    answer: {
      orgName: "Aster Network",
      orgImageUrl: null,
      emailPinned: false,
      invitedBy: "Someone",
      name: null,
      message: null,
      email: null,
      join: null,
    },
  },
  // The clock and guide stay subscribed through a sign-out; null with DEMO_MODE off.
  "demo:status": { args: {}, answer: null },
  // The guide stays subscribed through a sign-out too; null signed out, and null with DEMO_MODE off.
  "demo:personaPassword": { args: {}, answer: null },
  // The log-in page's demo picker (Task 9): empty with DEMO_MODE off.
  "demo:loginCast": { args: {}, answer: [] },
  // The public credential: a slug nobody holds answers null (the page's 404).
  "badges:publicBySlug": {
    args: { slug: "dan-okafor-ai-fundamentals" },
    answer: null,
  },
};

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
