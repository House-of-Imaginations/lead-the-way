import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { harness, type T } from "./workspace/helpers";

/**
 * R10: log-in and reset answers never say whether an account exists or which
 * field was wrong. Through the real HTTP routes, as a browser sends them.
 */
beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "a test secret at least 32 characters long");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const SITE = "http://localhost:3000";
const PASSWORD = "a long enough password";

async function post(t: T, path: string, body: object) {
  return await t.fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE },
    body: JSON.stringify(body),
  });
}

async function withBec() {
  const t = harness();
  const res = await post(t, "/sign-up/email", {
    name: "Bec",
    email: "bec@example.com",
    password: PASSWORD,
  });
  expect(res.status).toBe(200);
  return t;
}

test("a reset request answers the same for a known and an unknown email", async () => {
  const t = await withBec();
  const known = await post(t, "/request-password-reset", {
    email: "bec@example.com",
    redirectTo: "/reset-password",
  });
  const unknown = await post(t, "/request-password-reset", {
    email: "nobody@example.com",
    redirectTo: "/reset-password",
  });
  expect(known.status).toBe(200);
  expect(unknown.status).toBe(known.status);
  expect(await unknown.json()).toEqual(await known.json());
});

test("a wrong password and an unknown email fail the same way", async () => {
  const t = await withBec();
  const wrong = await post(t, "/sign-in/email", {
    email: "bec@example.com",
    password: "not the password at all",
  });
  const unknown = await post(t, "/sign-in/email", {
    email: "nobody@example.com",
    password: PASSWORD,
  });
  expect(wrong.status).toBe(401);
  expect(unknown.status).toBe(401);
  expect(await unknown.json()).toEqual(await wrong.json());
});

test("a password under 12 characters is refused", async () => {
  const t = harness();
  const res = await post(t, "/sign-up/email", {
    name: "Short",
    email: "short@example.com",
    password: "elevenchars",
  });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ code: "PASSWORD_TOO_SHORT" });
});
