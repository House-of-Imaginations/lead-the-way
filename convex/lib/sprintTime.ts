import type { Doc } from "../_generated/dataModel";

/**
 * The protected hour as instants and as words. `startDate` and `start` are
 * wall-clock values in the sprint's time zone, so "Wednesday 2:00 PM" stays
 * 2:00 PM when daylight saving starts mid-sprint.
 */

export type HourOf = Pick<
  Doc<"sprints">,
  "startDate" | "timeZone" | "protectedHour"
>;

/** `at`'s date parts in `timeZone`, by part type ("day", "month", "weekday"). */
export function parts(
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

/** `at`'s calendar date in `timeZone`, as "YYYY-MM-DD". */
function dateIn(at: number, timeZone: string): string {
  const p = parts(at, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "2026-09-09" plus `days`, as a date string. */
export function addDays(date: string, days: number): string {
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

/** A date string's day of the week, as `Date#getDay` numbers it (0 is Sunday). */
export function dayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Week `week`'s hour day, "YYYY-MM-DD" (week 1 is the first). */
function hourDate(sprint: HourOf, week: number): string {
  const shift =
    (sprint.protectedHour.weekday - dayOf(sprint.startDate) + 7) % 7;
  return addDays(sprint.startDate, shift + 7 * (week - 1));
}

/** When week `week`'s protected hour starts (week 1 is the first). */
export function hourStart(sprint: HourOf, week: number): number {
  return zoned(
    hourDate(sprint, week),
    sprint.protectedHour.start,
    sprint.timeZone,
  );
}

/** When week `week`'s protected hour ends. */
export function hourEnd(sprint: HourOf, week: number): number {
  return (
    hourStart(sprint, week) + sprint.protectedHour.durationMinutes * 60_000
  );
}

/**
 * Which week of the sprint `now` is in (Ruling 10). Weeks are calendar weeks
 * in the sprint's time zone: week 1 starts at 00:00 on the Monday of the
 * first hour's week. 0 before that; not clamped after the last week.
 * Counted in calendar days, so a week that loses an hour to daylight saving
 * still turns over at midnight on Monday. A draft's stored `startDate` is
 * stale: pass a launched sprint, or `{ ...sprint, startDate: startDateOf(sprint, now) }`.
 */
export function weekOf(sprint: HourOf, now: number): number {
  const first = hourDate(sprint, 1);
  const monday = addDays(first, -((dayOf(first) + 6) % 7));
  const days =
    (Date.parse(dateIn(now, sprint.timeZone)) - Date.parse(monday)) /
    86_400_000;
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}

/**
 * Week one is the week that starts on the first Monday after `now`, in
 * `timeZone` (Ruling 17). Returns that week's `weekday` (1 is Monday, 5 is
 * Friday) as "YYYY-MM-DD". On Tuesday 1 September, Wednesday is the 9th.
 */
export function weekOneDate(
  weekday: number,
  now: number,
  timeZone: string,
): string {
  const today = dateIn(now, timeZone);
  const toMonday = (8 - dayOf(today)) % 7 || 7;
  return addDays(today, toMonday + weekday - 1);
}

/**
 * Week one's hour day. A draft's is always worked out now, so every screen
 * names the same week and a draft revisited later never starts in the past
 * (Ruling 17); `launch` stores it. A launched sprint keeps the date it stored.
 */
export function startDateOf(
  sprint: Pick<
    Doc<"sprints">,
    "launchedAt" | "protectedHour" | "timeZone" | "startDate"
  >,
  now: number,
): string {
  return sprint.launchedAt === undefined
    ? weekOneDate(sprint.protectedHour.weekday, now, sprint.timeZone)
    : sprint.startDate;
}

/**
 * The next protected hour that hasn't ended: at the end of week 2's hour it
 * moves to week 3's. Null once the last has ended.
 */
export function nextHour(
  sprint: HourOf & Pick<Doc<"sprints">, "weeks">,
  now: number,
): { week: number; start: number } | null {
  for (let week = 1; week <= sprint.weeks; week++) {
    if (hourEnd(sprint, week) > now) {
      return { week, start: hourStart(sprint, week) };
    }
  }
  return null;
}

export type SprintPhase = "draft" | "scheduled" | "active" | "complete";

/**
 * Where a sprint is, from `launchedAt`, `completedAt` and the clock (Ruling
 * 10). Scheduled until week one's Monday, then active until the last hour
 * ends.
 */
export function sprintPhase(sprint: Doc<"sprints">, now: number): SprintPhase {
  if (sprint.launchedAt === undefined) return "draft";
  if (
    sprint.completedAt !== undefined ||
    now >= hourEnd(sprint, sprint.weeks)
  ) {
    return "complete";
  }
  return weekOf(sprint, now) === 0 ? "scheduled" : "active";
}

const EVERY = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/** "14:00" plus `minutes`, as "3:00 PM". */
function clockLabel(time: string, minutes = 0): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h! * 60 + m! + minutes) % (24 * 60);
  const hour = Math.floor(total / 60);
  const mm = String(total % 60).padStart(2, "0");
  return `${hour % 12 || 12}:${mm} ${hour < 12 ? "AM" : "PM"}`;
}

/** "Wednesdays, 2:00 PM to 3:00 PM": the hour as 04 and 07 write it (Ruling 19). */
export function hourPattern(
  weekday: number,
  start: string,
  durationMinutes: number,
): string {
  return `${EVERY[weekday]}, ${clockLabel(start)} to ${clockLabel(start, durationMinutes)}`;
}

/** "Wednesday 16 September at 2:00 PM": the overview's sentences. */
export function hourLong(at: number, timeZone: string): string {
  const p = parts(at, timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${p.weekday} ${p.day} ${p.month} at ${p.hour}:${p.minute} ${p.dayPeriod}`;
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
 * bar; employees see only the next hour and the privacy note (11). The week
 * is `weekOf`; the hour is the next one that hasn't ended, so after
 * Wednesday's hour it names next Wednesday while the week stays the same.
 */
export function sprintStatus(
  sprint: Doc<"sprints">,
  now: number,
  manager: boolean,
): SprintStatus {
  const tz = sprint.timeZone;
  const phase = sprintPhase(sprint, now);
  const note = manager ? null : "Your learning activity is private.";
  if (phase === "draft" || phase === "scheduled") {
    return {
      heading: null,
      progress: null,
      label: "Sprint starts",
      value: hourLabel(
        hourStart({ ...sprint, startDate: startDateOf(sprint, now) }, 1),
        tz,
      ),
      note: phase === "draft" ? null : note,
    };
  }
  if (phase === "complete") {
    return {
      heading: null,
      progress: null,
      label: "Sprint complete",
      value: spanLabel(
        hourStart(sprint, 1),
        hourStart(sprint, sprint.weeks),
        tz,
      ),
      note: null,
    };
  }
  const week = weekOf(sprint, now);
  // Active means the last hour hasn't ended, so there is a next one.
  const next = nextHour(sprint, now)!;
  return {
    heading: manager ? `Week ${week} of ${sprint.weeks}` : null,
    progress: manager ? { value: week, max: sprint.weeks } : null,
    label: next.week === sprint.weeks ? "Show and tell" : "Next protected hour",
    value: hourLabel(next.start, tz),
    note,
  };
}
