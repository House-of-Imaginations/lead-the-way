import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { components, internal } from "../../convex/_generated/api";
import { isDemoAddress } from "../../convex/lib/demo/cast";
import { sendEmail, type EmailCtx } from "../../convex/lib/email/send";
import { seedDemoAccounts } from "./testHelpers";
import { harness } from "./workspace/helpers";

// convex/auth.ts reads SITE_URL when the module loads, and convex-test loads
// it lazily on the first action that reaches it. Nothing here imports it
// statically, so these stubs land before it is first evaluated.
beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
  vi.stubEnv("DEMO_PASSWORD", "correct horse battery");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "a test secret at least 32 characters long");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test("the demo accounts need demo mode and a long password", async () => {
  const t = harness();
  vi.stubEnv("DEMO_PASSWORD", "short");
  await expect(t.action(internal.seed.accounts, {})).rejects.toThrow(
    /DEMO_PASSWORD to at least 12 characters/,
  );
  vi.stubEnv("DEMO_PASSWORD", "");
  await expect(t.action(internal.seed.accounts, {})).rejects.toThrow(
    /DEMO_PASSWORD/,
  );
  vi.stubEnv("DEMO_PASSWORD", "correct horse battery");
  vi.stubEnv("DEMO_MODE", "");
  await expect(t.action(internal.seed.accounts, {})).rejects.toMatchObject({
    data: { code: "FEATURE_UNAVAILABLE" },
  });
});

test("seeding reuses the accounts that exist", async () => {
  const t = harness();
  const seeded = await seedDemoAccounts(t);
  expect(await t.action(internal.seed.accounts, {})).toEqual(seeded);
});

test("a missing demo account is created through sign-up", async () => {
  const t = harness();
  const seeded = await seedDemoAccounts(t, ["grace"]);
  const ids = await t.action(internal.seed.accounts, {});

  expect(ids).toMatchObject(seeded);
  const grace = await t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: "grace.oyelaran@calderlane.com.au" }],
    }),
  );
  expect(grace).toMatchObject({ _id: ids.grace, name: "Grace Oyelaran" });
});

test("demo addresses never get email", async () => {
  expect(isDemoAddress("Dan.Okafor@CalderLane.com.au ")).toBe(true);
  expect(isDemoAddress("dan@example.com")).toBe(false);

  // A configured sender, so the only thing stopping the send is the address.
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "Lead the Way <hello@example.com>");
  await expect(
    sendEmail({} as EmailCtx, "dan.okafor@calderlane.com.au", "Hello", {
      heading: "Hello",
      paragraphs: [],
    }),
  ).resolves.toBe(false);
});
