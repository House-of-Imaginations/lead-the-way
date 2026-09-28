import { expect, test } from "vitest";
import {
  badgeCount,
  dayLabel,
  groupByDay,
  inboxHref,
  timeLabel,
} from "@/lib/inbox";

// Local-time constructors, so day boundaries hold in any runner time zone.
const at = (day: number, hour: number, minute = 0, year = 2026) =>
  new Date(year, 8, day, hour, minute).getTime();
const NOW = at(14, 15, 30);

test("inboxHref keeps same-origin paths and refuses everything else", () => {
  expect(inboxHref("/claims/abc?as=dealer&tab=overview")).toBe(
    "/claims/abc?as=dealer&tab=overview",
  );
  expect(inboxHref("/settings/notifications#push")).toBe(
    "/settings/notifications#push",
  );
  expect(inboxHref("https://evil.example/claims")).toBeNull();
  expect(inboxHref("//evil.example/claims")).toBeNull();
  expect(inboxHref("/\\evil.example")).toBeNull();
  expect(inboxHref("javascript:alert(1)")).toBeNull();
  expect(inboxHref("claims/abc")).toBeNull();
});

test("dayLabel names today and yesterday, then dates", () => {
  expect(dayLabel(at(14, 0, 1), NOW)).toBe("Today");
  expect(dayLabel(at(13, 23, 59), NOW)).toBe("Yesterday");
  expect(dayLabel(at(12, 9), NOW)).toBe("Sat, Sep 12");
  expect(dayLabel(at(12, 9, 0, 2025), NOW)).toBe("Sep 12, 2025");
});

test("timeLabel is relative today and a clock time before", () => {
  expect(timeLabel(NOW - 20_000, NOW)).toBe("Just now");
  expect(timeLabel(at(14, 15, 18), NOW)).toBe("12 min ago");
  expect(timeLabel(at(14, 12, 0), NOW)).toBe("3 h ago");
  expect(timeLabel(at(13, 9, 5), NOW)).toBe("9:05 AM");
});

test("groupByDay keeps order and splits on day changes", () => {
  const rows = [at(14, 15), at(14, 9), at(13, 20), at(10, 8)].map((t) => ({
    _creationTime: t,
  }));
  expect(groupByDay(rows, NOW).map((g) => [g.label, g.rows.length])).toEqual([
    ["Today", 2],
    ["Yesterday", 1],
    ["Thu, Sep 10", 1],
  ]);
});

test("badgeCount caps what fits", () => {
  expect(badgeCount(3)).toBe("3");
  expect(badgeCount(120)).toBe("99+");
});
