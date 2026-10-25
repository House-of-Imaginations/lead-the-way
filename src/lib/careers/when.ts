/**
 * Careers dates and times as the screens write them. Crew times are
 * wall-clock strings ("19:00") and dates are "YYYY-MM-DD", so these format in
 * UTC: the server and the browser print the same words.
 */

/** "19:00" as "7 PM", "07:30" as "7:30 AM". */
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h! % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h! < 12 ? "AM" : "PM"}`;
}

/** "Tue 3 Nov" (short) or "Tuesday 3 November" (long). */
export function dateLabel(date: string, style: "short" | "long"): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: style,
    day: "numeric",
    month: style,
  });
}

/** "27 October". */
export function dayMonth(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  });
}

/** An hour from "19:00" as "7 to 8 PM"; "11:30 AM to 12:30 PM" keeps both. */
export function hourSpan(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const from = timeLabel(time);
  const to = timeLabel(`${(h! + 1) % 24}:${m}`);
  return from.slice(-2) === to.slice(-2)
    ? `${from.slice(0, -3)} to ${to}`
    : `${from} to ${to}`;
}

// ponytail: every crew meets in Melbourne time in this demo; crews get a zone when one meets elsewhere.
const CREW_ZONE = "Australia/Melbourne";

/** An instant as "Tuesday 10 November, 7 PM", in the crew's time. */
export function atLabel(at: number): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: CREW_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: CREW_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return `${date.replace(",", "")}, ${timeLabel(time)}`;
}

/** "Tue 3 Nov, 7 PM": the next crew check-in. */
export function checkInLabel(
  date: string,
  time: string,
  style: "short" | "long" = "short",
): string {
  return `${dateLabel(date, style).replace(",", "")}, ${timeLabel(time)}`;
}
