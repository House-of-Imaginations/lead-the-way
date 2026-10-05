import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const source = (path: string) =>
  readFileSync(
    new URL(`../../src/app/(app)/me/${path}`, import.meta.url),
    "utf8",
  );

test("/me has one subscription, preloaded with the server's hour (Ruling 16)", () => {
  expect(source("page.tsx")).toMatch(
    /preloadAuthQuery\(\s*api\.me\.home,\s*\{\s*hour:\s*currentHour\(\)\s*\}/,
  );
  const home = source("Home.tsx");
  expect(home).toMatch(/usePreloadedQuery\(\s*preloaded\s*\)/);
  expect(home).not.toMatch(/\buseQuery\(/);
});

test("/me/sprint asks again each hour (Review Focus 6)", () => {
  // useTimedQuery sends useHour()'s hour and keeps the last answer over the turnover.
  const sprint = source("sprint/MySprint.tsx");
  expect(sprint).toMatch(/useTimedQuery\(\s*api\.me\.sprint\s*\)/);
  expect(sprint).not.toMatch(/\buseQuery\(/);
});
