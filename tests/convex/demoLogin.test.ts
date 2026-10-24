import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { ACCOUNT_HOLDERS } from "../../convex/lib/demo/cast";
import { harness } from "./workspace/helpers";

// Task 9. The route reads the cast through `fetchQuery`, here the real query
// on convex-test, and signs in through the auth proxy, here a stub.
const t = harness();
vi.mock("convex/nextjs", () => ({
  fetchQuery: (ref: typeof api.demo.loginCast) => t.query(ref, {}),
}));
const signIn = vi.fn<(request: Request) => Promise<Response>>(
  async () =>
    new Response(JSON.stringify({ token: "session-token" }), {
      headers: { "set-cookie": "better-auth.session_token=abc; Path=/" },
    }),
);
vi.mock("../../src/lib/account/auth-server", () => ({
  handler: { POST: (request: Request) => signIn(request) },
}));
const { POST } = await import("../../src/app/api/demo/login/route");

const PASSWORD = "the-shared-demo-password";
const DAN = "dan.okafor@calderlane.com.au";

const login = (email: unknown) =>
  POST(
    new Request("http://localhost:3000/api/demo/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://x" },
      body: JSON.stringify({ email }),
    }),
  );

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
  vi.stubEnv("DEMO_PASSWORD", PASSWORD);
  signIn.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

test("loginCast lists every account holder by name, email and role only", async () => {
  const cast = await t.query(api.demo.loginCast, {});
  expect(cast.map((p) => p.email)).toEqual(ACCOUNT_HOLDERS.map((p) => p.email));
  expect(cast[0]).toEqual({
    name: "Priya Raman",
    email: "priya.raman@calderlane.com.au",
    role: "Manager",
  });
  expect(cast.filter((p) => p.role === "Manager")).toHaveLength(1);
  for (const person of cast)
    expect(Object.keys(person).sort()).toEqual(["email", "name", "role"]);
});

test("loginCast is empty with demo mode off", async () => {
  vi.stubEnv("DEMO_MODE", "");
  expect(await t.query(api.demo.loginCast, {})).toEqual([]);
});

test("a cast email signs in with the server's password and gets only the cookie", async () => {
  const res = await login(DAN);
  expect(res.status).toBe(204);
  expect(await res.text()).toBe("");
  expect(res.headers.getSetCookie()).toEqual([
    "better-auth.session_token=abc; Path=/",
  ]);
  const sent = signIn.mock.calls[0][0];
  expect(new URL(sent.url).pathname).toBe("/api/auth/sign-in/email");
  expect(sent.headers.get("origin")).toBe("http://x");
  expect(await sent.json()).toEqual({ email: DAN, password: PASSWORD });
});

test("an email outside the cast is refused without a sign-in", async () => {
  for (const email of ["omar.haddad@calderlane.com.au", "a@b.c", 7, null]) {
    const res = await login(email);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  }
  expect(signIn).not.toHaveBeenCalled();
});

test("demo mode off, or no password on the server, is a 404 without a sign-in", async () => {
  vi.stubEnv("DEMO_MODE", "");
  expect((await login(DAN)).status).toBe(404);
  vi.stubEnv("DEMO_MODE", "on");
  vi.stubEnv("DEMO_PASSWORD", "");
  expect((await login(DAN)).status).toBe(404);
  expect(signIn).not.toHaveBeenCalled();
});

test("a failed sign-in is the generic refusal", async () => {
  signIn.mockResolvedValueOnce(new Response("{}", { status: 401 }));
  const res = await login(DAN);
  expect(res.status).toBe(401);
  expect(await res.text()).toBe("");
});
