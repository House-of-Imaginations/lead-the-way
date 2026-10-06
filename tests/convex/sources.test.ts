import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * Rules about where code lives in `convex/`, read from the source. Each list
 * here grows on purpose, with the choice made.
 *
 * `setupSprint` is the newest sprint, draft or not. After "Run another sprint"
 * that is the clone, so a reader that means "the sprint people are in" reads
 * `launchedSprint` or `joinedSprint` instead (P7a Ruling 15, P7b-1).
 */
const SETUP_SPRINT_FILES = [
  "agreements.ts",
  "invites.ts",
  "lib/agreement.ts",
  "lib/demo/moveClock.ts",
  "lib/demo/script.ts",
  "lib/shell.ts",
  "lib/sprint.ts",
  "manager.ts",
  "pathway.ts",
  "seed.ts",
  "sprints.ts",
  "teams.ts",
  "workspace.ts",
];

function convexSources() {
  const dir = new URL("../../convex/", import.meta.url);
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => file.endsWith(".ts") && !file.startsWith("_generated"))
    .map((file) => ({
      file,
      source: readFileSync(new URL(file, dir), "utf8"),
    }));
}

test("setupSprint is called only where the allowlist says", () => {
  const found = convexSources()
    .filter(({ source }) => /\bsetupSprint\(/.test(source))
    .map(({ file }) => file)
    .sort();
  expect(found).toEqual(SETUP_SPRINT_FILES);
});

test("nothing is called currentSprint any more", () => {
  expect(
    convexSources()
      .filter(({ source }) => /\bcurrentSprint\b/.test(source))
      .map(({ file }) => file),
  ).toEqual([]);
});

test("sprints are inserted in three places only, so one draft at most (one-draft rule)", () => {
  // Writer rule 1 (`lib/demo/script.ts`): the demo seed, setup's first draft
  // (`lib/sprint.ts`) and "Run another sprint" (`sprints.ts`), which refuses
  // while a draft exists.
  const counts = Object.fromEntries(
    convexSources()
      .map(({ file, source }) => [
        file,
        (source.match(/insert\(\s*"sprints"/g) ?? []).length,
      ])
      .filter(([, n]) => n),
  );
  expect(counts).toEqual({
    "lib/demo/calderLane.ts": 1,
    "lib/sprint.ts": 1,
    "sprints.ts": 1,
  });
});

test("only onboarding.start reads the viewer outside the viewer builders", () => {
  // Every other mutation is a viewerMutation, which checks `expectOrgId`
  // (P7b-0). `onboarding.start` has no workspace to expect until it makes one.
  // ponytail: reads each `export const` block's own text, so a helper that
  // calls getViewer for a mutation isn't caught; check by hand if one appears.
  const found = convexSources().flatMap(({ file, source }) =>
    source
      .split(/^(?=export const \w+ = )/m)
      .map((block) => ({
        block,
        head: /^export const (\w+) = (\w+)(?:<[^(]*>)?\(/.exec(block),
      }))
      .filter(
        ({ block, head }) =>
          head !== null &&
          /^(mutation|authenticatedMutation|publicMutation)$/.test(head[2]) &&
          /\b(getViewer|requireViewer)\(/.test(block),
      )
      .map(({ head }) => `${file} ${head![1]}`),
  );
  expect(found).toEqual(["onboarding.ts start"]);
});

test("the owner role is asked about in one place (isOwnerRole)", () => {
  // `kind` against "owner" or "custom", either way round, or a `case "owner"`.
  // The other two files look up a custom role by name or by having no
  // permissions: they never ask whether somebody is an owner.
  const asksKind =
    /\bkind\s*[!=]==?\s*"(owner|custom)"|"(owner|custom)"\s*[!=]==?\s*[\w.?]*\bkind\b|case\s+"owner"/;
  expect(
    convexSources()
      .filter(({ source }) => asksKind.test(source))
      .map(({ file }) => file)
      .sort(),
  ).toEqual(["lib/orgs/invites.ts", "lib/orgs/membership.ts", "seed.ts"]);
});
