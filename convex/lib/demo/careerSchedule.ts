import { literals } from "convex-helpers/validators";
import { zoned } from "../sprintTime";
import { DEMO_TIME_ZONE } from "./schedule";

/**
 * Where the careers clock can jump to (spec 7). A reset starts it at `week1`.
 * Melbourne wall-clock times, AEDT here, through the zone helper. Its own
 * module so the guide's client code can read it.
 */
export const CAREER_TARGETS = {
  week1: zoned("2026-10-26", "09:00", DEMO_TIME_ZONE),
  week2: zoned("2026-11-03", "12:00", DEMO_TIME_ZONE),
  week3: zoned("2026-11-10", "12:00", DEMO_TIME_ZONE),
  proof: zoned("2026-11-16", "12:00", DEMO_TIME_ZONE),
} as const;
export type ClockTarget = keyof typeof CAREER_TARGETS;
export const careerTargetValidator = literals(
  "week1",
  "week2",
  "week3",
  "proof",
  "missedWeek",
);
export type CareerTarget = ClockTarget | "missedWeek";
