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

/** RFC 5545 text: backslash, semicolon and comma escaped, newlines as \n. */
function text(value: string): string {
  return value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

/**
 * One VEVENT per week, each in UTC from `hourStart`, so no VTIMEZONE is needed
 * and a daylight saving change mid-sprint keeps the wall-clock hour.
 * ponytail: DTSTAMP is the event's start, so the same hour always makes the same file.
 */
export function icsFor(hour: CalendarHour): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lead the Way//Protected hour//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (let week = 1; week <= hour.weeks; week++) {
    const [start, end] = span(hour, week);
    lines.push(
      "BEGIN:VEVENT",
      `UID:ltw-${hour.startDate}-${week}@lead-the-way`,
      `DTSTAMP:${start}`,
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
