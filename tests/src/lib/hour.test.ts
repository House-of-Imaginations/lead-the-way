import { expect, test } from "vitest";
import { hourOf, msToNextHour } from "../../../src/lib/hour";

test("msToNextHour counts to the next top of the hour", () => {
  const three = Date.parse("2026-09-16T05:00:00Z"); // 3:00 PM in Melbourne
  expect(msToNextHour(three - 30 * 60_000)).toBe(30 * 60_000);
  expect(msToNextHour(three - 1)).toBe(1);
  expect(msToNextHour(three)).toBe(3_600_000);
  expect(hourOf(three - 1)).toBe(hourOf(three) - 1);
});
