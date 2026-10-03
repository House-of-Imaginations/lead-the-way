// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  state: undefined as number | undefined,
  set: [] as number[],
  effects: [] as (() => void | (() => void))[],
}));
vi.mock("react", () => ({
  useState: (init: () => number) => [
    (h.state ??= init()),
    (next: number) => h.set.push(next),
  ],
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
