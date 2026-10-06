import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * R6: `orgQuery` and `orgMutation` were frozen in P3 and retired in P7b-2.
 * Every product function goes through `getViewer` (viewerQuery,
 * viewerMutation, timedViewerQuery); the one function that names another
 * workspace, `profiles.setActiveOrg`, checks its own seat. Neither name may
 * come back, not even in a comment that points a reader at it.
 */
const dir = new URL("../../convex/", import.meta.url);

test("orgQuery and orgMutation are gone", () => {
  const found: string[] = [];
  for (const file of readdirSync(dir, { recursive: true }) as string[]) {
    if (!file.endsWith(".ts") || file.startsWith("_generated")) continue;
    const source = readFileSync(new URL(file, dir), "utf8");
    if (/\borg(?:Query|Mutation)\b/.test(source)) found.push(file);
  }
  expect(found).toEqual([]);
});
