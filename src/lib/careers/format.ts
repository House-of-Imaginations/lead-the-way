// ponytail: Melbourne, the demo cast's zone; the learner's own `timezone` when a screen needs it.
const ZONE = "Australia/Melbourne";

/** "16 November 2026". */
export function earnedOn(at: number): string {
  return new Date(at).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ZONE,
  });
}

const DAYS = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

const hour12 = (h: number) => `${h % 12 || 12}`;

/** A crew's hour-long check-in, `day` 0 for Sunday and `time` "19:00": "Tuesdays 7 to 8 PM". */
export function weeklyCheckIn(day: number, time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const end = (h + 1) % 24;
  const mins = m ? `:${String(m).padStart(2, "0")}` : "";
  const half = (x: number) => (x < 12 ? "AM" : "PM");
  const start =
    half(h) === half(end)
      ? `${hour12(h)}${mins}`
      : `${hour12(h)}${mins} ${half(h)}`;
  return `${DAYS[day]} ${start} to ${hour12(end)}${mins} ${half(end)}`;
}
