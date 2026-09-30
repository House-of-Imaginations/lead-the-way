import { expect, test } from "vitest";
import { googleCalendarUrl, icsFor, type CalendarHour } from "@/lib/calendar";

// The demo's hour: Wednesdays at 2:00 PM in Melbourne (AEST, UTC+10 in September).
const HOUR: CalendarHour = {
  startDate: "2026-09-09",
  timeZone: "Australia/Melbourne",
  protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
  title: "Protected learning hour",
  weeks: 4,
};

const starts = (ics: string) =>
  [...ics.matchAll(/DTSTART:(\w+)/g)].map((m) => m[1]);

test("icsFor has four weekly events in UTC", () => {
  const ics = icsFor(HOUR);
  expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  // CRLF only: no bare line feed or carriage return anywhere.
  expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  expect(ics).not.toContain("VTIMEZONE");
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  expect(starts(ics)).toEqual([
    "20260909T040000Z",
    "20260916T040000Z",
    "20260923T040000Z",
    "20260930T040000Z",
  ]);
  expect([...ics.matchAll(/DTEND:(\w+)/g)].map((m) => m[1])).toEqual([
    "20260909T050000Z",
    "20260916T050000Z",
    "20260923T050000Z",
    "20260930T050000Z",
  ]);
  expect([...ics.matchAll(/UID:(\S+)/g)].map((m) => m[1])).toEqual([
    "ltw-2026-09-09-1@lead-the-way",
    "ltw-2026-09-09-2@lead-the-way",
    "ltw-2026-09-09-3@lead-the-way",
    "ltw-2026-09-09-4@lead-the-way",
  ]);
  expect(ics).toContain("SUMMARY:Protected learning hour\r\n");

  // Still 2:00 PM on the wall once daylight saving starts (Sunday 4 October).
  expect(starts(icsFor({ ...HOUR, startDate: "2026-09-30" }))).toEqual([
    "20260930T040000Z",
    "20261007T030000Z",
    "20261014T030000Z",
    "20261021T030000Z",
  ]);
  // Text values are escaped.
  expect(icsFor({ ...HOUR, title: "Learn, try; share" })).toContain(
    "SUMMARY:Learn\\, try\\; share\r\n",
  );
});

test("googleCalendarUrl repeats four times", () => {
  const url = new URL(googleCalendarUrl(HOUR));
  expect(url.origin + url.pathname).toBe(
    "https://calendar.google.com/calendar/render",
  );
  expect(Object.fromEntries(url.searchParams)).toEqual({
    action: "TEMPLATE",
    text: "Protected learning hour",
    dates: "20260909T040000Z/20260909T050000Z",
    recur: "RRULE:FREQ=WEEKLY;COUNT=4",
    ctz: "Australia/Melbourne",
  });
});
