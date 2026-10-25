import { weeksForHours, type Hours } from "@convex/lib/careers/catalog";

/** The 1, 2 or 3 hours switcher on Tell us and the Pivot Map. */
export const HOUR_OPTIONS = [
  { value: "1", label: "1 hr" },
  { value: "2", label: "2 hrs" },
  { value: "3", label: "3 hrs" },
];

export function hoursLine(hours: Hours) {
  return `At ${hours} ${hours === 1 ? "hour" : "hours"} a week, your map takes about ${weeksForHours(hours).total} weeks.`;
}
