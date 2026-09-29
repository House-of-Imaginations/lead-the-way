import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * R6: `orgQuery` and `orgMutation` are frozen in P3 and retire in P7. These
 * are the callers left, per file. The counts only go down; a new caller fails
 * here. Product functions use `viewerQuery` and `viewerMutation`.
 */
const FROZEN: Record<string, number> = {
  "invites.ts": 4,
  "members.ts": 4,
  "orgRoles.ts": 4,
  "orgs.ts": 6,
  "profiles.ts": 1,
};

const dir = new URL("../../convex/", import.meta.url);

test("no new callers of orgQuery or orgMutation", () => {
  const found: Record<string, number> = {};
  for (const file of readdirSync(dir, { recursive: true }) as string[]) {
    if (!file.endsWith(".ts") || file.startsWith("_generated")) continue;
    const source = readFileSync(new URL(file, dir), "utf8");
    const calls = source.match(/=\s*org(?:Query|Mutation)\(/g)?.length ?? 0;
    if (calls > 0) found[file] = calls;
  }
  // Nothing found would pass a per-file bound vacuously; pin the whole set.
  expect(Object.keys(found).sort()).toEqual(Object.keys(FROZEN).sort());
  for (const [file, calls] of Object.entries(found)) {
    expect(calls, file).toBeLessThanOrEqual(FROZEN[file] ?? 0);
  }
});
