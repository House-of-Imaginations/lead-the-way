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
 * Helpers that read the clock for their caller. Add a new one here when you
 * write one, or a query calling it will not be caught.
 */
const CLOCK_HELPERS = [
  "refusalOf",
  "shellOf",
  "agreementForViewer",
  "launchedFor",
  "joinFacts",
  "weekNow",
];

/**
 * Frozen orgQuery functions (their file is not to change), so they cannot take
 * `hour`: `invites.list` reads the clock through `nowIn`.
 */
const FROZEN = ["invites.ts:list"];

const READS_CLOCK = new RegExp(
  `\\.now\\b|nowIn\\(|nowFor\\(|\\b(?:${CLOCK_HELPERS.join("|")})\\(`,
);

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
  const timed = exportedQueries().filter(
    (q) => READS_CLOCK.test(q.body) && !FROZEN.includes(q.name),
  );
  // Nothing found would pass vacuously.
  expect(timed.map((q) => q.name)).toEqual(
    expect.arrayContaining([
      "sprints.ts:current",
      "manager.ts:overview",
      "viewer.ts:shell",
      "invites.ts:publicPreview",
      "invites.ts:preview",
      "invites.ts:teamPreview",
      "me.ts:home",
      "me.ts:sprint",
      "projects.ts:mine",
      "showAndTell.ts:board",
      "agreements.ts:forMe",
    ]),
  );
  expect(
    timed
      .filter(
        (q) =>
          q.builder !== "timedViewerQuery" &&
          !/hour: v\.optional\(v\.number\(\)\)/.test(q.body),
      )
      .map((q) => q.name),
  ).toEqual([]);
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
  expect(await owner.query(api.invites.preview, { token: "t", hour: 1 })).toBe(
    null,
  );
});
