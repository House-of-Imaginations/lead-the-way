/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
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
