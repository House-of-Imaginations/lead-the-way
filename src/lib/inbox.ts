/**
 * The inbox's pure rules: where a row may send you, how its time reads, and
 * which day it is filed under. Kept out of the page so the suite, which renders
 * nothing, can pin them.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * The in-app path a notification opens, or null when its url leaves this
 * origin. `router.push` and `<Link>` will follow `javascript:` or another host,
 * so a stored url is resolved against a throwaway base and kept only if it
 * stayed there.
 */
export function inboxHref(url: string): string | null {
  const base = "https://inbox.invalid";
  try {
    const resolved = new URL(url, base);
    if (resolved.origin !== base || !url.startsWith("/")) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

/** Start of the local day containing `ms`. */
function startOfDay(ms: number) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const DAY_WITH_YEAR = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const CLOCK = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** "Today", "Yesterday", "Fri, Sep 12", or "Sep 12, 2025" outside this year. */
export function dayLabel(ms: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(ms)) / (24 * HOUR));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(ms).getFullYear() === new Date(now).getFullYear()
    ? DAY.format(ms)
    : DAY_WITH_YEAR.format(ms);
}

/** "Just now", "12 min ago", "3 h ago" today; the clock time on older days. */
export function timeLabel(ms: number, now: number): string {
  const ago = now - ms;
  if (startOfDay(ms) !== startOfDay(now)) return CLOCK.format(ms);
  if (ago < MINUTE) return "Just now";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  return `${Math.floor(ago / HOUR)} h ago`;
}

/** Rows already newest first, split into consecutive days in that order. */
export function groupByDay<R extends { _creationTime: number }>(
  rows: readonly R[],
  now: number,
): { label: string; rows: R[] }[] {
  const groups: { label: string; rows: R[] }[] = [];
  for (const row of rows) {
    const label = dayLabel(row._creationTime, now);
    const last = groups.at(-1);
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

/** What a badge can fit. The accessible text always carries the real number. */
export const badgeCount = (count: number) =>
  count > 99 ? "99+" : String(count);
