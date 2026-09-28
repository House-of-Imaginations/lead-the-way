/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { PURGE_WINDOW_MS } from "../../convex/lib/account/window";
import { registerComponents } from "./testHelpers";

const modules = import.meta.glob("../../convex/**/*.ts");

const ALICE = { subject: "user_alice" };

function harness() {
  const t = convexTest(schema, modules);
  registerComponents(t);
  return t;
}

test("a signed-out caller has no profile, and that is not an error", async () => {
  const t = harness();
  await expect(t.query(api.profiles.me, {})).resolves.toBeNull();
});

test("saving a name creates the profile, and saving again renames it", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);

  await alice.mutation(api.profiles.saveProfile, { displayName: "Alice" });
  await expect(alice.query(api.profiles.me, {})).resolves.toMatchObject({
    displayName: "Alice",
    avatarUrl: null,
  });

  await alice.mutation(api.profiles.saveProfile, { displayName: "Alicia" });
  const profile = await alice.query(api.profiles.me, {});
  expect(profile?.displayName).toBe("Alicia");

  // One row, not two. An upsert that inserted twice would be invisible until
  // `.unique()` started throwing on a read months later.
  const count = await t.run(
    async (ctx) => (await ctx.db.query("profiles").collect()).length,
  );
  expect(count).toBe(1);
});

test("an empty name is refused", async () => {
  const t = harness();
  await expect(
    t
      .withIdentity(ALICE)
      .mutation(api.profiles.saveProfile, { displayName: "  " }),
  ).rejects.toMatchObject({ data: { code: "NAME_REQUIRED" } });
});

/**
 * The soft delete, which is the part of the account lifecycle most likely to go
 * quietly wrong: the tombstone has to be invisible to every ordinary read, and
 * visible to exactly one.
 */
test("a deleted account looks signed-out to the product, and is restorable", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);
  await alice.mutation(api.profiles.saveProfile, { displayName: "Alice" });

  await alice.mutation(api.account.deleteAccount, {});

  await expect(alice.query(api.profiles.me, {})).resolves.toBeNull();
  // The one function allowed to admit the row is still there.
  await expect(
    alice.query(api.account.deletionStatus, {}),
  ).resolves.toMatchObject({
    deletedAt: expect.any(Number),
    purgeAt: expect.any(Number),
  });

  await alice.mutation(api.account.restoreAccount, {});
  await expect(alice.query(api.profiles.me, {})).resolves.toMatchObject({
    displayName: "Alice",
  });
});

/**
 * THE TRAP THIS PINS: an absent `deletedAt` sorts BEFORE every number in the
 * index, so a one-sided `lt(cutoff)` range matches every live profile and the
 * tidy-up job deletes the accounts of people who never asked.
 */
test("the purge takes expired tombstones and leaves live accounts alone", async () => {
  const t = harness();
  const now = Date.now();

  await t.run(async (ctx) => {
    await ctx.db.insert("profiles", {
      userId: "live",
      displayName: "Live",
      createdAt: now,
    });
    await ctx.db.insert("profiles", {
      userId: "recent",
      displayName: "Recent",
      createdAt: now,
      deletedAt: now - 1000,
    });
    await ctx.db.insert("profiles", {
      userId: "expired",
      displayName: "Expired",
      createdAt: now,
      deletedAt: now - PURGE_WINDOW_MS - 1000,
    });
  });

  await expect(t.mutation(internal.account.purgeExpired, {})).resolves.toBe(1);

  const left = await t.run(async (ctx) =>
    (await ctx.db.query("profiles").collect()).map((row) => row.userId).sort(),
  );
  expect(left).toEqual(["live", "recent"]);
});

/**
 * THE DEFECT THIS PINS: the purge deleted the profile row and nothing else, so
 * a "deleted" account's notes stayed readable by anything holding the user id,
 * and its avatar stayed in file storage forever. The row count looked right,
 * which is why it survived -- the test above passes either way.
 */
test("the purge takes what the account owned, not only its profile row", async () => {
  const t = harness();
  const now = Date.now();

  const avatarId = await t.run(async (ctx) => {
    const stored = await ctx.storage.store(
      new Blob(["pretend png"], { type: "image/png" }),
    );
    await ctx.db.insert("profiles", {
      userId: "expired",
      displayName: "Expired",
      createdAt: now,
      deletedAt: now - PURGE_WINDOW_MS - 1000,
      avatarId: stored,
    });
    await ctx.db.insert("notes", {
      userId: "expired",
      text: "theirs",
      createdAt: now,
    });
    // A live account's notes are not this job's business.
    await ctx.db.insert("profiles", {
      userId: "live",
      displayName: "Live",
      createdAt: now,
    });
    await ctx.db.insert("notes", {
      userId: "live",
      text: "someone else's",
      createdAt: now,
    });
    return stored;
  });

  await expect(t.mutation(internal.account.purgeExpired, {})).resolves.toBe(1);

  const after = await t.run(async (ctx) => ({
    notes: (await ctx.db.query("notes").collect()).map((row) => row.userId),
    avatar: await ctx.db.system.get(avatarId),
  }));

  expect(after.notes).toEqual(["live"]);
  expect(after.avatar).toBeNull();
});

/**
 * The budget is per RUN, not per account, and an account it cannot finish keeps
 * its tombstone so the next pass starts where this one stopped. Without that,
 * a large account is either a transaction too big to commit or a row deleted
 * with its notes still behind it.
 */
test("an account too big for one run is finished by the continuation", async () => {
  const t = harness();
  const now = Date.now();

  await t.run(async (ctx) => {
    await ctx.db.insert("profiles", {
      userId: "hoarder",
      displayName: "Hoarder",
      createdAt: now,
      deletedAt: now - PURGE_WINDOW_MS - 1000,
    });
    for (let i = 0; i < 600; i += 1) {
      await ctx.db.insert("notes", {
        userId: "hoarder",
        text: `note ${i}`,
        createdAt: now,
      });
    }
  });

  // Over the 500-delete budget, so the first pass cannot reach the row itself.
  vi.useFakeTimers();
  try {
    await expect(t.mutation(internal.account.purgeExpired, {})).resolves.toBe(
      0,
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally {
    vi.useRealTimers();
  }

  const left = await t.run(async (ctx) => ({
    profiles: (await ctx.db.query("profiles").collect()).length,
    notes: (await ctx.db.query("notes").collect()).length,
  }));
  expect(left).toEqual({ profiles: 0, notes: 0 });
});
