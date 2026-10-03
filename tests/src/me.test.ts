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
  const sprint = source("sprint/MySprint.tsx");
  expect(sprint).toMatch(/const hour = useHour\(\);/);
  expect(sprint).toMatch(/useQuery\(\s*api\.me\.sprint,\s*\{\s*hour\s*\}\s*\)/);
});
