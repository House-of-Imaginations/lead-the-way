/**
 * The choices on setup screens 03 and 04, as the wireframes write them. The
 * server refuses anything else, so a stored value is always one a screen can
 * show. Sizes are "2 to 5", not 03's "2-5" (house copy: ranges with "to").
 */
export const TEAM_SIZES = [
  "2 to 5",
  "6 to 10",
  "11 to 20",
  "21 or more",
] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const INDUSTRIES = [
  "Professional services",
  "Marketing",
  "Finance",
  "Technology",
  "Education",
  "Not-for-profit",
  "Other",
] as const;

export const TEAM_FUNCTIONS = [
  "Marketing",
  "Operations",
  "Client service",
  "HR",
  "Finance",
  "Product",
  "General administration",
] as const;

/** `label` is what is stored in `teams.aiUse`. */
export const AI_USE = [
  { label: "Not using AI", description: "Little or no use yet" },
  {
    label: "Exploring occasionally",
    description: "A few people try it now and then",
  },
  { label: "Using AI regularly", description: "Part of some weekly tasks" },
  {
    label: "Advanced users, inconsistent practices",
    description: "Heavy use, but everyone does it differently",
  },
] as const;

export const CHALLENGES = [
  "Unsure what AI tools are safe",
  "Staff are using AI differently",
  "Lack of time to learn",
  "Difficult to turn learning into work",
  "Staff are reluctant to discuss AI use",
  "Hard to demonstrate capability",
  "Other",
] as const;

/** 04's start times: on the hour, 9:00 AM to 4:00 PM. */
export const HOUR_STARTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
] as const;

/** The "not ready" dialog's reasons. The screen's "Choose a reason" is no reason. */
export const NOT_READY_REASONS = [
  "I need approval from my own manager",
  "Our workload is too high right now",
  "A shorter weekly session would work better",
  "Something else",
] as const;

/** "Something else" words in the not ready dialog. */
export const MAX_DETAIL = 500;

/** 04's "hrs paid time a week, team total": one hour a head, near the band's middle. */
export const TEAM_HOURS: Record<TeamSize, number> = {
  "2 to 5": 4,
  "6 to 10": 8,
  "11 to 20": 16,
  "21 or more": 24,
};

/** True when `value` is one of `options` (and narrows it). */
export function isOneOf<T extends string>(
  options: readonly T[],
  value: string,
): value is T {
  return (options as readonly string[]).includes(value);
}
