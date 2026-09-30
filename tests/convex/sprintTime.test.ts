import { expect, test } from "vitest";
import {
  hourLabel,
  hourStart,
  spanLabel,
  sprintStatus,
} from "../../convex/lib/sprintTime";
import type { Doc } from "../../convex/_generated/dataModel";

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

test("noon and midnight read as 12 PM and 12 AM", () => {
  expect(hourLabel(Date.parse("2026-09-16T12:00:00+10:00"), MEL)).toBe(
    "Wed 16 Sep, 12:00 PM",
  );
  expect(hourLabel(Date.parse("2026-09-16T00:00:00+10:00"), MEL)).toBe(
    "Wed 16 Sep, 12:00 AM",
  );
});

test("during the hour itself, that hour is still the next one", () => {
  const launched = {
    ...sprint("2026-09-09"),
    weeks: 4,
    launchedAt: 1,
  } as Doc<"sprints">;
  const during = Date.parse("2026-09-16T14:30:00+10:00");
  expect(sprintStatus(launched, during, true)).toMatchObject({
    heading: "Week 2 of 4",
    value: "Wed 16 Sep, 2:00 PM",
  });
  expect(
    sprintStatus(launched, Date.parse("2026-09-16T15:00:00+10:00"), true),
  ).toMatchObject({ heading: "Week 3 of 4" });
});

test("employees in week 4 and after completion", () => {
  const launched = {
    ...sprint("2026-09-09"),
    weeks: 4,
    launchedAt: 1,
  } as Doc<"sprints">;
  expect(
    sprintStatus(launched, Date.parse("2026-09-24T10:00:00+10:00"), false),
  ).toEqual({
    heading: null,
    progress: null,
    label: "Show and tell",
    value: "Wed 30 Sep, 2:00 PM",
    note: "Your learning activity is private.",
  });
  expect(
    sprintStatus(
      { ...launched, completedAt: 2 },
      Date.parse("2026-09-24T10:00:00+10:00"),
      false,
    ),
  ).toEqual({
    heading: null,
    progress: null,
    label: "Sprint complete",
    value: "9 to 30 September 2026",
    note: null,
  });
});
