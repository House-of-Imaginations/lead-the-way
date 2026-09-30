import type { Doc } from "../_generated/dataModel";

/**
 * The protected hour as instants and as words. `startDate` and `start` are
 * wall-clock values in the sprint's time zone, so "Wednesday 2:00 PM" stays
 * 2:00 PM when daylight saving starts mid-sprint.
 */

type HourOf = Pick<Doc<"sprints">, "startDate" | "timeZone" | "protectedHour">;

function parts(
  at: number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options,
  }).formatToParts(at)) {
    out[p.type] = p.value;
  }
  return out;
}

/** How far the zone's wall clock is ahead of UTC at `at`, in ms. */
function offsetAt(timeZone: string, at: number): number {
  const p = parts(at, timeZone, {
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const wall = Date.UTC(
    +p.year!,
    +p.month! - 1,
    +p.day!,
    +p.hour!,
    +p.minute!,
    +p.second!,
  );
  return wall - (at - (at % 1000));
}

/** "2026-09-09" plus `days`, as a date string. */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** A wall-clock date and time in `timeZone`, as epoch ms. */
function zoned(date: string, time: string, timeZone: string): number {
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  const guess = asUtc - offsetAt(timeZone, asUtc);
  // Once more, in case the guess crossed a daylight saving change.
  return asUtc - offsetAt(timeZone, guess);
}

/** When week `week`'s protected hour starts (week 1 is the first). */
export function hourStart(sprint: HourOf, week: number): number {
  const startDay = new Date(`${sprint.startDate}T00:00:00Z`).getUTCDay();
  const shift = (sprint.protectedHour.weekday - startDay + 7) % 7;
  const date = addDays(sprint.startDate, shift + 7 * (week - 1));
  return zoned(date, sprint.protectedHour.start, sprint.timeZone);
}

/** "Wed 16 Sep, 2:00 PM" */
export function hourLabel(at: number, timeZone: string): string {
  const p = parts(at, timeZone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

/** "9 to 30 September 2026", "30 September to 21 October 2026", or across years. */
export function spanLabel(from: number, to: number, timeZone: string): string {
  const opts = { day: "numeric", month: "long", year: "numeric" } as const;
  const a = parts(from, timeZone, opts);
  const b = parts(to, timeZone, opts);
  const end = `${b.day} ${b.month} ${b.year}`;
  if (a.year !== b.year) return `${a.day} ${a.month} ${a.year} to ${end}`;
  if (a.month !== b.month) return `${a.day} ${a.month} to ${end}`;
  return `${a.day} to ${end}`;
}

export type SprintStatus = {
  heading: string | null;
  progress: { value: number; max: number } | null;
  label: string;
  value: string;
  note: string | null;
};

/**
 * The side nav status block (spec 7.1). Managers see the week and a progress
 * bar; employees see only the next hour and the privacy note (11).
 */
export function sprintStatus(
  sprint: Doc<"sprints">,
  now: number,
  manager: boolean,
): SprintStatus {
  const tz = sprint.timeZone;
  const first = hourStart(sprint, 1);
  if (sprint.launchedAt === undefined) {
    return {
      heading: null,
      progress: null,
      label: "Sprint starts",
      value: hourLabel(first, tz),
      note: null,
    };
  }
  const length = sprint.protectedHour.durationMinutes * 60_000;
  let week = 0;
  for (let w = 1; w <= sprint.weeks; w++) {
    if (hourStart(sprint, w) + length > now) {
      week = w;
      break;
    }
  }
  if (sprint.completedAt !== undefined || week === 0) {
    return {
      heading: null,
      progress: null,
      label: "Sprint complete",
      value: spanLabel(first, hourStart(sprint, sprint.weeks), tz),
      note: null,
    };
  }
  return {
    heading: manager ? `Week ${week} of ${sprint.weeks}` : null,
    progress: manager ? { value: week, max: sprint.weeks } : null,
    label: week === sprint.weeks ? "Show and tell" : "Next protected hour",
    value: hourLabel(hourStart(sprint, week), tz),
    note: manager ? null : "Your learning activity is private.",
  };
}
