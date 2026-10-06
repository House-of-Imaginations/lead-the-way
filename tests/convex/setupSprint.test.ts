import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * `setupSprint` is the newest sprint, draft or not. After "Run another sprint"
 * that is the clone, so a reader that means "the sprint people are in" reads
 * `launchedSprint` or `joinedSprint` instead (P7a Ruling 15, P7b-1). A new
 * caller is added here on purpose, with that choice made.
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
