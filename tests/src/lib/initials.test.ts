import { expect, test } from "vitest";
import { initialsOf } from "../../../src/lib/initials";

// The cases of convex/lib/orgs/people.ts#initialsOf. ponytail: not imported
// here, since that module loads convex/auth.ts.
const CASES: [string, string][] = [
  ["Priya Raman", "PR"],
  ["  dan   okafor ", "DO"],
  ["Mary Jane Watson", "MW"],
  ["Cher", "C"],
  ["", "?"],
  ["   ", "?"],
];

test("initials are the first letters of the first and last words, ? for none", () => {
  for (const [name, initials] of CASES)
    expect(initialsOf(name), JSON.stringify(name)).toBe(initials);
});
