import { hourStart, type HourOf } from "@convex/lib/sprintTime";

/** A sprint's protected hour, ready for someone's calendar (Ruling 21). */
export type CalendarHour = HourOf & { title: string; weeks: number };

/** An instant in iCalendar's UTC form: 20260909T040000Z. */
function utc(at: number): string {
  return new Date(at).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/** Week `week`'s hour as UTC start and end. */
function span(hour: CalendarHour, week: number): [string, string] {
  const start = hourStart(hour, week);
  return [utc(start), utc(start + hour.protectedHour.durationMinutes * 60_000)];
}

/** RFC 5545 text: backslash, semicolon and comma escaped, any line break as \n. */
function text(value: string): string {
  return value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r\n?|\n/g, "\\n");
}

/**
 * One VEVENT per week, each in UTC from `hourStart`, so no VTIMEZONE is needed
 * and a daylight saving change mid-sprint keeps the wall-clock hour. The UID
 * carries the date and the time, so a changed hour imports as new events.
 * DTSTAMP is `now`, when the file is made.
 */
export function icsFor(hour: CalendarHour, now = Date.now()): string {
  const stamp = utc(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//From zero to hero//Protected hour//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (let week = 1; week <= hour.weeks; week++) {
    const [start, end] = span(hour, week);
    lines.push(
      "BEGIN:VEVENT",
      `UID:ltw-${hour.startDate}-${hour.protectedHour.start}-${week}@lead-the-way`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${text(hour.title)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * A prefilled recurring event. ponytail: a daylight saving change inside the
 * sprint shifts Google's series by an hour (Ruling 21); the .ics stays exact.
 */
export function googleCalendarUrl(hour: CalendarHour): string {
  const [start, end] = span(hour, 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: hour.title,
    dates: `${start}/${end}`,
    recur: `RRULE:FREQ=WEEKLY;COUNT=${hour.weeks}`,
    ctz: hour.timeZone,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
