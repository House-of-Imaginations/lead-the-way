import { literals } from "convex-helpers/validators";

/**
 * When things happen in the demo, in Melbourne time.
 *
 * September 2026 is AEST, UTC+10 (daylight saving starts 4 October), so a
 * fixed offset is exact for every date here. Don't reuse `mel` for a date
 * after 3 October.
 */
export const DEMO_TIME_ZONE = "Australia/Melbourne";

/** A Melbourne wall-clock time, "2026-09-09T14:00", as epoch milliseconds. */
export const mel = (local: string) => Date.parse(`${local}:00+10:00`);

/** Where the tester can jump the clock to (the /guide buttons). */
export const DEMO_TARGETS = {
  setup: mel("2026-09-01T09:30"),
  week1: mel("2026-09-09T13:00"),
  week2: mel("2026-09-16T13:00"),
  week3: mel("2026-09-23T13:00"),
  week4: mel("2026-09-30T13:00"),
  complete: mel("2026-09-30T16:00"),
} as const;
export type DemoTarget = keyof typeof DEMO_TARGETS;
export const demoTargetValidator = literals(
  "setup",
  "week1",
  "week2",
  "week3",
  "week4",
  "complete",
);

/** Where a reset starts the demo: Tuesday 1 September, 9:30 AM. */
export const DEMO_NOW = DEMO_TARGETS.setup;

/**
 * Every scripted step and when it is due, in time order. The reset writes one
 * `demoScript` row per entry; `STEPS` in `script.ts` says what each does.
 */
export const SCHEDULE = {
  "priya.team": mel("2026-09-01T10:00"),
  "priya.commit": mel("2026-09-02T11:00"),
  "priya.pathway": mel("2026-09-04T11:00"),
  "priya.agreement": mel("2026-09-07T11:00"),
  "priya.launch": mel("2026-09-08T10:00"),
  "team.join": mel("2026-09-08T16:00"),
  "team.before": mel("2026-09-08T17:00"),
  "team.sign": mel("2026-09-09T09:00"),
  "team.beforeLate": mel("2026-09-09T13:30"),
  "team.signLate": mel("2026-09-09T13:45"),
  "sprint.start": mel("2026-09-09T14:00"),
  "week1.session": mel("2026-09-09T15:00"),
  "priya.coaching": mel("2026-09-15T11:00"),
  "week2.progress": mel("2026-09-15T17:00"),
  "week2.session": mel("2026-09-16T15:00"),
  "week3.session": mel("2026-09-23T15:00"),
  "dan.badge": mel("2026-09-24T10:00"),
  "week4.projects": mel("2026-09-29T17:00"),
  "week4.present": mel("2026-09-30T14:30"),
  "week4.session": mel("2026-09-30T15:00"),
  "sprint.complete": mel("2026-09-30T15:01"),
  "week4.after": mel("2026-09-30T15:30"),
  "dan.reflection": mel("2026-09-30T15:45"),
} as const;
export type StepKey = keyof typeof SCHEDULE;
