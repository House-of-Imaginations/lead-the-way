// @vitest-environment node
import { expect, test } from "vitest";
import { landingAfterJoin } from "../../../src/app/join/_components/landing";

test("RR2: a join with no before check-in goes home, past the check-in", () => {
  expect(landingAfterJoin({ askBefore: false })).toBe("/home");
  expect(landingAfterJoin({ askBefore: true })).toBeNull();
  // No sprint yet: ask, as sprint 1 does at join.
  expect(landingAfterJoin(null)).toBeNull();
});
