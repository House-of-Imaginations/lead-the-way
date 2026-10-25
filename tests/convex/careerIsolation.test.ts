import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { CAREER_TABLES } from "../../convex/lib/orgs/cascade";

/**
 * X2: no team function reads career data. Today that holds because of what
 * the code does, so these sweeps pin the call graph by source: the career
 * tables are named only in the files below, only the shared `viewer.*`
 * functions call `getAccount`, and no file mixes the team builders with the
 * career ones. A new reader is added to an allowlist on purpose, with that
 * choice made. The convex tests are outside this scan and may name anything.
 */
const dir = new URL("../../convex/", import.meta.url);
const sources = (readdirSync(dir, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".ts") && !file.startsWith("_generated"))
  .map((file) => ({ file, source: readFileSync(new URL(file, dir), "utf8") }));

/** Names a module imports with `import { a, b as c } from "..."`. */
function imported(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(
    /^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']/gm,
  ))
    for (const part of m[1]!.split(",")) {
      const name = part
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)[0]!
        .trim();
      if (name) names.add(name);
    }
  return names;
}

const CAREER_TABLE_FILES = [
  "careers/careerSettings.ts",
  "careers/crews.ts",
  "careers/demoDay.ts",
  "careers/drafts.ts",
  "careers/guide.ts",
  "careers/hours.ts",
  "careers/learning.ts",
  "careers/partners.ts",
  "careers/proof.ts",
  "careers/tracks.ts",
  "careers/wipe.ts",
  "lib/careers/crew.ts",
  "lib/careers/writers.ts",
  // The careers clock and counts (plan A3), and the careers seed.
  "demo.ts",
  "lib/demo/pivotCrews.ts",
  "lib/orgs/cascade.ts",
  "lib/viewer.ts",
  "schema.ts",
  "seed.ts",
  "tables/careers.ts",
];

test.each(CAREER_TABLES)(
  "the %s table is named only where the allowlist says",
  (table) => {
    const named = new RegExp(`["'\`]${table}["'\`]`);
    const found = sources
      .filter(({ source }) => named.test(source))
      .map(({ file }) => file);
    // Nothing found would pass vacuously: `CAREER_TABLES` names every one.
    expect(found).toContain("lib/orgs/cascade.ts");
    expect(found.filter((file) => !CAREER_TABLE_FILES.includes(file))).toEqual(
      [],
    );
  },
);

test("only the shared functions import getAccount (spec 5.2)", () => {
  expect(
    sources
      .filter(({ source }) => imported(source).has("getAccount"))
      .map(({ file }) => file)
      .sort(),
  ).toEqual(["home.ts", "privacy.ts", "viewer.ts"]);
});

const TEAM_BUILDERS = ["viewerQuery", "viewerMutation", "timedViewerQuery"];
const CAREER_IDENTITY = [
  "getCareer",
  "requireCareer",
  "careerQuery",
  "careerMutation",
];

test("no file imports both a team builder and career identity", () => {
  const team = sources.filter(({ source }) => {
    const names = imported(source);
    return TEAM_BUILDERS.some((n) => names.has(n));
  });
  // Nothing found would pass vacuously.
  expect(team.map(({ file }) => file)).toContain("manager.ts");
  expect(
    team
      .filter(({ source }) => {
        const names = imported(source);
        return CAREER_IDENTITY.some((n) => names.has(n));
      })
      .map(({ file }) => file),
  ).toEqual([]);
});
