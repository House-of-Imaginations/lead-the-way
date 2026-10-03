import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { harness, workspace } from "./workspace/helpers";

/**
 * Ruling 16: a query that reads the clock goes stale when the hour turns,
 * unless the client sends a new `hour`. So every exported query whose handler
 * reads `.now` (`viewer.now`, or `Date.now()`, which is stale in the same way)
 * is built with `timedViewerQuery`, which declares it.
 */
const dir = new URL("../../convex/", import.meta.url);
const QUERY =
  /^(?:publicQuery|authenticatedQuery|viewerQuery|timedViewerQuery|orgQuery|query)$/;

/**
 * Queries that read the clock inside a helper, so the scan can't see it.
 * `viewer.shell` reads `viewer.now` in `shellOf`, and answers null signed
 * out, so it stays a publicQuery that declares `hour` itself.
 */
const INDIRECT: Record<string, string> = { "viewer.ts:shell": "publicQuery" };

/** Every `export const x = builder(...)({ ... });` in a top-level module. */
function exportedQueries() {
  const out: { name: string; builder: string; body: string }[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(new URL(file, dir), "utf8");
    for (const m of source.matchAll(
      /^export const (\w+) = (\w+)\b[\s\S]*?^\}\);$/gm,
    )) {
      const builder = m[2]!;
      if (QUERY.test(builder)) {
        out.push({ name: `${file}:${m[1]!}`, builder, body: m[0] });
      }
    }
  }
  return out;
}

test("every query that reads the clock takes hour (Ruling 16)", () => {
  const all = exportedQueries();
  const timed = all.filter((q) => /\.now\b/.test(q.body));
  // Nothing found would pass vacuously.
  expect(timed.map((q) => q.name)).toEqual(
    expect.arrayContaining(["sprints.ts:current", "manager.ts:overview"]),
  );
  expect(
    timed.filter((q) => q.builder !== "timedViewerQuery").map((q) => q.name),
  ).toEqual([]);
  for (const [name, builder] of Object.entries(INDIRECT)) {
    const found = all.find((q) => q.name === name);
    expect(found?.builder, name).toBe(builder);
    expect(found?.body, name).toMatch(/hour: v\.optional\(v\.number\(\)\)/);
  }
});

test("the timed queries take hour and ignore it", async () => {
  const t = harness();
  const { owner } = await workspace(t);
  expect(await owner.query(api.sprints.current, { hour: 1 })).toEqual(
    await owner.query(api.sprints.current, {}),
  );
  expect(await owner.query(api.sprints.launchPage, { hour: 1 })).toEqual(
    await owner.query(api.sprints.launchPage, {}),
  );
  expect(await owner.query(api.agreements.current, { hour: 1 })).toEqual(
    await owner.query(api.agreements.current, {}),
  );
  expect(await owner.query(api.manager.overview, { hour: 1 })).toEqual(
    await owner.query(api.manager.overview, {}),
  );
});
