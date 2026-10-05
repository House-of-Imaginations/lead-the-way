import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * `settingsOf` is the one reader of a person's settings, and it holds the "no
 * row means the defaults" rule (Ruling 5). Only the writer and the seat's own
 * clean-up query the table by name. `deleteOrg` (lib/orgs/cascade.ts) clears
 * it too, through its `ORG_TABLES` loop, so it never names the table here. A
 * new direct reader is added on purpose, with that choice made.
 */
const SETTINGS_QUERY_FILES = ["lib/orgs/membership.ts", "lib/settings.ts"];

test("the settings table is queried by name only where the allowlist says", () => {
  const dir = new URL("../../convex/", import.meta.url);
  const found = (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => file.endsWith(".ts") && !file.startsWith("_generated"))
    .filter((file) =>
      /\.query\(\s*"settings"\s*\)/.test(
        readFileSync(new URL(file, dir), "utf8"),
      ),
    )
    .sort();
  expect(found).toEqual(SETTINGS_QUERY_FILES);
});
