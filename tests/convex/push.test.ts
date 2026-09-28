/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { registerComponents } from "./testHelpers";

const modules = import.meta.glob("../../convex/**/*.ts");

const ALICE = { subject: "user_alice" };
const BOB = { subject: "user_bob" };

function harness() {
  const t = convexTest(schema, modules);
  registerComponents(t);
  return t;
}

const DEVICE = {
  endpoint: "https://push.example/alice-phone",
  p256dh: "p",
  auth: "a",
};

test("push is off when the deployment has no VAPID keys", async () => {
  const t = harness();
  // `delete`, not an empty string: `process.env.X = ""` is a SET variable whose
  // value is falsy, and the handler answers `?? null` on absence.
  delete process.env.VAPID_PUBLIC_KEY;
  // Null, not an error: a deployment with no keys is the normal state of this
  // feature until somebody issues them, and every screen draws it as absence.
  await expect(t.query(api.push.publicKey, {})).resolves.toBeNull();
});

test("null and zero are different answers from myDeviceCount", async () => {
  const t = harness();

  // Nobody to file a subscription under.
  await expect(t.query(api.push.myDeviceCount, {})).resolves.toBeNull();
  // Known, with nothing subscribed. The toggle is drawn, and off.
  await expect(
    t.withIdentity(ALICE).query(api.push.myDeviceCount, {}),
  ).resolves.toBe(0);
});

test("re-subscribing the same browser updates the row instead of adding one", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);

  await alice.mutation(api.push.subscribe, DEVICE);
  await alice.mutation(api.push.subscribe, { ...DEVICE, p256dh: "rotated" });

  await expect(alice.query(api.push.myDeviceCount, {})).resolves.toBe(1);
  const stored = await t.run(
    async (ctx) => await ctx.db.query("pushSubscriptions").collect(),
  );
  // The keys are re-read on every subscribe: a browser rotates them whenever it
  // makes a genuinely new subscription, and encrypting to a stale key produces
  // a payload that phone can never open.
  expect(stored[0].p256dh).toBe("rotated");
});

test("an endpoint can only be unsubscribed by the account that owns it", async () => {
  const t = harness();
  await t.withIdentity(ALICE).mutation(api.push.subscribe, DEVICE);

  // An endpoint is a string a client supplies. Without the ownership check,
  // anybody holding one could silence the person it belongs to.
  await t
    .withIdentity(BOB)
    .mutation(api.push.unsubscribe, { endpoint: DEVICE.endpoint });
  await expect(
    t.withIdentity(ALICE).query(api.push.myDeviceCount, {}),
  ).resolves.toBe(1);

  await t
    .withIdentity(ALICE)
    .mutation(api.push.unsubscribe, { endpoint: DEVICE.endpoint });
  await expect(
    t.withIdentity(ALICE).query(api.push.myDeviceCount, {}),
  ).resolves.toBe(0);
});

test("deleting an account drops its subscriptions at the tap", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);
  await alice.mutation(api.profiles.saveProfile, { displayName: "Alice" });
  await alice.mutation(api.push.subscribe, DEVICE);

  await alice.mutation(api.account.deleteAccount, {});

  // Not restored by `restoreAccount` either: re-subscribing is one tap, and
  // buzzing somebody's phone after they deleted their account is not.
  const stored = await t.run(
    async (ctx) => await ctx.db.query("pushSubscriptions").collect(),
  );
  expect(stored).toHaveLength(0);
});

/**
 * The guard that matters most in this file: with no keys configured,
 * `pushSend` must return BEFORE it loads `web-push` or opens a socket. The
 * network guard in `tests/setup.ts` only wraps `fetch`, and `web-push` sends
 * over `https.request` -- so a send from a test would go out on the wire
 * silently and the suite would stay green.
 */
test("a queued send does nothing when the deployment has no keys", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);
  await alice.mutation(api.push.subscribe, DEVICE);

  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;

  vi.useFakeTimers();
  try {
    await alice.mutation(api.push.sendTest, {});
    // Drained INSIDE the test that posted it. A job left pending fires after
    // teardown, where the network guard's hooks can no longer see it.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }
});

test("event preferences default to on and are kept per account", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);

  await expect(t.query(api.push.myPreferences, {})).resolves.toBeNull();
  const initial = await alice.query(api.push.myPreferences, {});
  expect(initial?.every((p) => p.enabled)).toBe(true);

  await alice.mutation(api.push.setPreference, {
    event: "example",
    enabled: false,
  });
  // Twice, to prove the second write patches rather than adds a row.
  await alice.mutation(api.push.setPreference, {
    event: "example",
    enabled: false,
  });

  const after = await alice.query(api.push.myPreferences, {});
  expect(after?.find((p) => p.event === "example")?.enabled).toBe(false);
  const rows = await t.run((ctx) =>
    ctx.db.query("notificationPreferences").collect(),
  );
  expect(rows).toHaveLength(1);

  // Bob never said anything, so everything is still on for him.
  const bob = await t.withIdentity(BOB).query(api.push.myPreferences, {});
  expect(bob?.every((p) => p.enabled)).toBe(true);
});
