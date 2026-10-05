import { expect, test } from "vitest";
import {
  hourEnd,
  hourLabel,
  hourLong,
  hourPattern,
  hourRange,
  hourStart,
  spanLabel,
  sprintPhase,
  sprintStatus,
  weekOf,
  weekOneDate,
  zoneNote,
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
  // Once it ends, the next hour moves on and the week stays (Ruling 10).
  expect(
    sprintStatus(launched, Date.parse("2026-09-16T15:00:00+10:00"), true),
  ).toMatchObject({ heading: "Week 2 of 4", value: "Wed 23 Sep, 2:00 PM" });
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

const at = (local: string) => Date.parse(`${local}:00+10:00`);

test("weekOneDate picks the next working week", () => {
  // Tuesday 1 September, 9:30 AM: next week is 7 to 11 September.
  expect(weekOneDate(3, at("2026-09-01T09:30"), MEL)).toBe("2026-09-09");
  expect(weekOneDate(1, at("2026-09-01T09:30"), MEL)).toBe("2026-09-07");
  // On a Monday, week one is the following week, never the one under way.
  expect(weekOneDate(3, at("2026-09-07T09:00"), MEL)).toBe("2026-09-16");
  expect(weekOneDate(5, at("2026-09-06T20:00"), MEL)).toBe("2026-09-11");
});

test("sprintPhase is derived from launch and time", () => {
  const draft = { ...sprint("2026-09-09"), weeks: 4 } as Doc<"sprints">;
  const launched = { ...draft, launchedAt: at("2026-09-01T10:00") };
  expect(sprintPhase(draft, at("2026-09-20T10:00"))).toBe("draft");
  expect(sprintPhase(launched, at("2026-09-06T23:59"))).toBe("scheduled");
  expect(sprintPhase(launched, at("2026-09-07T00:00"))).toBe("active");
  expect(sprintPhase(launched, at("2026-09-09T00:00"))).toBe("active");
  expect(sprintPhase(launched, at("2026-09-30T14:59"))).toBe("active");
  expect(sprintPhase(launched, at("2026-09-30T15:00"))).toBe("complete");
  expect(
    sprintPhase(
      { ...launched, completedAt: at("2026-09-20T10:00") },
      at("2026-09-20T10:00"),
    ),
  ).toBe("complete");
});

test("hourPattern names the day and both times", () => {
  expect(hourPattern(3, "14:00", 60)).toBe("Wednesdays, 2:00 PM to 3:00 PM");
  expect(hourPattern(1, "09:00", 60)).toBe("Mondays, 9:00 AM to 10:00 AM");
  expect(hourPattern(5, "11:00", 60)).toBe("Fridays, 11:00 AM to 12:00 PM");
});

// The demo sprint: Wednesdays 9 to 30 September, week one from Monday the 7th.
const demo = {
  ...sprint("2026-09-09"),
  weeks: 4,
  launchedAt: at("2026-09-08T10:00"),
} as Doc<"sprints">;

test("weekOf counts calendar weeks from week one's Monday", () => {
  expect(weekOf(demo, at("2026-09-01T09:30"))).toBe(0);
  expect(weekOf(demo, at("2026-09-06T23:59"))).toBe(0);
  expect(weekOf(demo, at("2026-09-07T00:00"))).toBe(1);
  expect(weekOf(demo, at("2026-09-13T23:59"))).toBe(1);
  expect(weekOf(demo, at("2026-09-14T00:00"))).toBe(2);
  expect(weekOf(demo, at("2026-09-16T15:01"))).toBe(2);
  expect(weekOf(demo, at("2026-10-01T09:00"))).toBe(4);
  // Not clamped: the Monday after the sprint is week 5.
  expect(weekOf(demo, Date.parse("2026-10-05T00:00:00+11:00"))).toBe(5);
});

test("after week 2's hour the status names week 3's and stays on week 2", () => {
  expect(sprintStatus(demo, at("2026-09-16T15:01"), true)).toEqual({
    heading: "Week 2 of 4",
    progress: { value: 2, max: 4 },
    label: "Next protected hour",
    value: "Wed 23 Sep, 2:00 PM",
    note: null,
  });
});

test("a launched sprint says when it starts until week one's Monday", () => {
  const sunday = at("2026-09-06T23:59");
  expect(sprintPhase(demo, sunday)).toBe("scheduled");
  expect(sprintStatus(demo, sunday, true)).toEqual({
    heading: null,
    progress: null,
    label: "Sprint starts",
    value: "Wed 9 Sep, 2:00 PM",
    note: null,
  });
  expect(sprintStatus(demo, sunday, false)).toEqual({
    heading: null,
    progress: null,
    label: "Sprint starts",
    value: "Wed 9 Sep, 2:00 PM",
    note: "Your learning activity is private.",
  });
  const monday = at("2026-09-07T00:00");
  expect(sprintPhase(demo, monday)).toBe("active");
  expect(sprintStatus(demo, monday, true)).toEqual({
    heading: "Week 1 of 4",
    progress: { value: 1, max: 4 },
    label: "Next protected hour",
    value: "Wed 9 Sep, 2:00 PM",
    note: null,
  });
});

test("weekOf and hourStart across 4 October", () => {
  // Wednesdays 23 September to 14 October: daylight saving starts on the 4th.
  const dst = {
    ...sprint("2026-09-23"),
    weeks: 4,
    launchedAt: 1,
  } as Doc<"sprints">;
  expect(new Date(hourStart(dst, 3)).toISOString()).toBe(
    "2026-10-07T03:00:00.000Z",
  );
  expect(new Date(hourEnd(dst, 3)).toISOString()).toBe(
    "2026-10-07T04:00:00.000Z",
  );
  expect(weekOf(dst, Date.parse("2026-09-20T23:59:00+10:00"))).toBe(0);
  expect(weekOf(dst, Date.parse("2026-09-21T00:00:00+10:00"))).toBe(1);
  // Week 2 is an hour short in Melbourne; week 3 still starts at midnight.
  expect(weekOf(dst, Date.parse("2026-10-04T23:59:00+11:00"))).toBe(2);
  expect(weekOf(dst, Date.parse("2026-10-05T00:00:00+11:00"))).toBe(3);
  expect(
    sprintStatus(dst, Date.parse("2026-10-05T00:00:00+11:00"), true),
  ).toMatchObject({ heading: "Week 3 of 4", value: "Wed 7 Oct, 2:00 PM" });
});

test("hourLong spells the hour out", () => {
  expect(hourLong(at("2026-09-16T14:00"), MEL)).toBe(
    "Wednesday 16 September at 2:00 PM",
  );
  expect(hourLong(Date.parse("2026-10-07T14:00:00+11:00"), MEL)).toBe(
    "Wednesday 7 October at 2:00 PM",
  );
  expect(hourLong(at("2026-09-09T09:00"), MEL)).toBe(
    "Wednesday 9 September at 9:00 AM",
  );
});

test("hourRange keeps one AM or PM when both ends share it (Ruling 17)", () => {
  const two = { weekday: 3, start: "14:00", durationMinutes: 60 };
  expect(hourRange(two, "long")).toBe("Wednesday, 2:00 to 3:00 PM");
  expect(hourRange(two, "short")).toBe("Wed 2:00 to 3:00 PM");
  expect(
    hourRange({ weekday: 1, start: "11:30", durationMinutes: 60 }, "long"),
  ).toBe("Monday, 11:30 AM to 12:30 PM");
  expect(
    hourRange({ weekday: 5, start: "09:00", durationMinutes: 45 }, "short"),
  ).toBe("Fri 9:00 to 9:45 AM");
});

test("zoneNote names the sprint's city only when the viewer is elsewhere", () => {
  expect(zoneNote(MEL, MEL)).toBe("");
  expect(zoneNote(MEL, "Europe/London")).toBe(", Melbourne time");
  expect(zoneNote("America/New_York", MEL)).toBe(", New York time");
  expect(zoneNote("America/Argentina/Buenos_Aires", "UTC")).toBe(
    ", Buenos Aires time",
  );
});
