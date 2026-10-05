// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: undefined as number | undefined,
  set: [] as number[],
  ticks: 0,
  effects: [] as (() => void | (() => void))[],
}));
// First useState is the hour, the second is the tick.
let calls = 0;
vi.mock("react", () => ({
  useState: (init: () => number) =>
    calls++ % 2 === 0
      ? [(h.state ??= init()), (next: number) => h.set.push(next)]
      : [0, () => h.ticks++],
  useEffect: (effect: () => void | (() => void)) => {
    h.effects.push(effect);
  },
}));

import { hourOf } from "../../../src/lib/hour";
import { useHour } from "../../../src/lib/useHour";

afterEach(() => {
  vi.useRealTimers();
});

test("useHour turns over 5 s after the top of the hour, and stops on unmount", () => {
  vi.useFakeTimers();
  const three = Date.parse("2026-09-16T05:00:00Z"); // 3:00 PM in Melbourne
  vi.setSystemTime(three - 30 * 60_000); // 2:30 PM
  expect(useHour()).toBe(hourOf(three) - 1);
  const stop = h.effects.at(-1)!();

  vi.advanceTimersByTime(30 * 60_000 + 4_999);
  expect(h.set).toEqual([]);
  vi.advanceTimersByTime(1);
  expect(h.set).toEqual([hourOf(three)]);

  // A cleared timer never fires.
  h.set.length = 0;
  const again = h.effects.at(-1)!();
  if (typeof again === "function") again();
  vi.advanceTimersByTime(2 * 3_600_000);
  expect(h.set).toEqual([]);
  if (typeof stop === "function") stop();
});

test("useHour re-arms when the timer fires and the hour has not moved", () => {
  vi.useFakeTimers();
  h.state = undefined;
  h.set.length = 0;
  h.ticks = 0;
  const three = Date.parse("2026-09-16T05:00:00Z");
  vi.setSystemTime(three - 60_000);
  const hour = useHour();
  // The wall clock is stuck (stepped back), so a fire sees the same hour.
  const now = vi.spyOn(Date, "now").mockReturnValue(three - 60_000);
  h.effects.at(-1)!();
  vi.advanceTimersByTime(65_000);
  expect(h.set).toEqual([hour]);
  // The callback bumped the tick, so the effect runs again and re-arms.
  expect(h.ticks).toBe(1);
  h.effects.at(-1)!();
  vi.advanceTimersByTime(65_000);
  expect(h.set).toEqual([hour, hour]);
  // Later the hour really turns, and the re-armed timer still reports it.
  now.mockReturnValue(three + 1_000);
  h.effects.at(-1)!();
  vi.advanceTimersByTime(3_700_000);
  expect(h.set.at(-1)).toBe(hourOf(three));
  now.mockRestore();
});
