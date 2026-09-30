import { expect, test } from "vitest";
import { hourLabel, hourStart, spanLabel } from "../../convex/lib/sprintTime";

const MEL = "Australia/Melbourne";
const sprint = (startDate: string) => ({
  startDate,
  timeZone: MEL,
  protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
});

test("the hour is the same wall-clock time every week, across daylight saving", () => {
  // Melbourne moves to UTC+11 on 4 October 2026.
  expect(hourStart(sprint("2026-09-30"), 1)).toBe(
    Date.parse("2026-09-30T14:00:00+10:00"),
  );
  expect(hourStart(sprint("2026-09-30"), 2)).toBe(
    Date.parse("2026-10-07T14:00:00+11:00"),
  );
});

test("a start date that isn't the protected day moves to the next one", () => {
  // Monday 7 September: the first Wednesday is the 9th.
  expect(hourStart(sprint("2026-09-07"), 1)).toBe(
    Date.parse("2026-09-09T14:00:00+10:00"),
  );
});

test("labels read the way the screens write them", () => {
  const at = Date.parse("2026-09-16T14:00:00+10:00");
  expect(hourLabel(at, MEL)).toBe("Wed 16 Sep, 2:00 PM");
  expect(
    spanLabel(
      Date.parse("2026-09-09T14:00:00+10:00"),
      Date.parse("2026-09-30T14:00:00+10:00"),
      MEL,
    ),
  ).toBe("9 to 30 September 2026");
  expect(
    spanLabel(
      Date.parse("2026-09-30T14:00:00+10:00"),
      Date.parse("2026-10-21T14:00:00+11:00"),
      MEL,
    ),
  ).toBe("30 September to 21 October 2026");
  expect(
    spanLabel(
      Date.parse("2026-12-16T14:00:00+11:00"),
      Date.parse("2027-01-06T14:00:00+11:00"),
      MEL,
    ),
  ).toBe("16 December 2026 to 6 January 2027");
});
