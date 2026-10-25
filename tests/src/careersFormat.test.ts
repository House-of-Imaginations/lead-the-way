import { expect, test } from "vitest";
import { earnedOn, weeklyCheckIn } from "@/lib/careers/format";

test("weeklyCheckIn names the day and the hour, sharing AM or PM when it can", () => {
  expect(weeklyCheckIn(2, "19:00")).toBe("Tuesdays 7 to 8 PM");
  expect(weeklyCheckIn(4, "11:30")).toBe("Thursdays 11:30 AM to 12:30 PM");
  expect(weeklyCheckIn(0, "09:00")).toBe("Sundays 9 to 10 AM");
});

test("earnedOn is the Melbourne date", () => {
  // 9:00 AM AEDT on 16 November is still 15 November in UTC.
  expect(earnedOn(Date.parse("2026-11-15T22:00:00Z"))).toBe("16 November 2026");
});
