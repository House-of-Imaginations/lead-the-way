/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { registerComponents } from "./testHelpers";

/**
 * The example feature's tests, and the shape every backend test here takes.
 *
 * `import.meta.glob` builds the whole `convex/` module graph, which is what
 * makes `api.*` real inside the test runtime -- it is required, not a style
 * choice, and it is why these files carry the `vite/client` reference.
 *
 * WHAT IS WORTH TESTING IN A CONVEX FUNCTION: the authorisation boundary (a
 * signed-out caller, and one user reading another's rows), the validation, and
 * the fallback an action takes when the network misbehaves. The happy path is
 * the cheapest of the four and the least likely to break.
 */
const modules = import.meta.glob("../../convex/**/*.ts");

const ALICE = { subject: "user_alice" };
const BOB = { subject: "user_bob" };

function harness() {
  const t = convexTest(schema, modules);
  registerComponents(t);
  return t;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("a signed-out caller cannot read or write notes", async () => {
  const t = harness();

  await expect(t.query(api.notes.list, {})).rejects.toThrow(ConvexError);
  await expect(t.mutation(api.notes.add, { text: "hello" })).rejects.toThrow(
    ConvexError,
  );
});

test("a note is written for the caller, and read back by them", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);

  await alice.mutation(api.notes.add, { text: "  buy milk  " });

  const notes = await alice.query(api.notes.list, {});
  expect(notes).toHaveLength(1);
  // Trimmed on the way in, so a stray space is never what a screen renders.
  expect(notes[0].text).toBe("buy milk");
  // The owner column is projected away: nothing the caller already knows, and
  // nothing a future private column can ride along with.
  expect(notes[0]).not.toHaveProperty("userId");
});

test("one account never sees another's notes", async () => {
  const t = harness();

  await t.withIdentity(ALICE).mutation(api.notes.add, { text: "alice's" });
  await t.withIdentity(BOB).mutation(api.notes.add, { text: "bob's" });

  const forBob = await t.withIdentity(BOB).query(api.notes.list, {});
  expect(forBob.map((note) => note.text)).toEqual(["bob's"]);
});

test("an empty note is refused with a code the client can branch on", async () => {
  const t = harness();

  await expect(
    t.withIdentity(ALICE).mutation(api.notes.add, { text: "   " }),
  ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
});

test("the action calls the provider, and writes what comes back", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);
  await alice.mutation(api.notes.add, { text: "buy milk" });

  // Stubbed, never reached. `tests/setup.ts` makes the real `fetch` throw, so
  // an un-stubbed call here fails the run rather than billing an account.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        choices: [
          { message: { content: JSON.stringify({ summary: "One errand." }) } },
        ],
      }),
    ),
  );
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  const summary = await alice.action(api.notes.summarize, {
    prompt: "buy milk",
  });
  expect(summary).toBe("One errand.");

  const notes = await alice.query(api.notes.list, {});
  expect(notes.map((note) => note.text)).toContain("One errand.");
});

test("a provider failure is a value, not an exception the screen has to catch", async () => {
  const t = harness();
  const alice = t.withIdentity(ALICE);

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("upstream is down", { status: 500 })),
  );
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  // The empty string is the documented "nothing came back" answer. An action
  // that threw here would take down the screen for an outage it can survive.
  await expect(
    alice.action(api.notes.summarize, { prompt: "buy milk" }),
  ).resolves.toBe("");
});
