// @vitest-environment node
import { expect, test, vi } from "vitest";

// One component's renders, by hand: the query's answer per render, and the one useState.
const h = vi.hoisted(() => ({
  result: undefined as unknown,
  last: undefined as unknown,
  started: false,
  args: [] as unknown[],
}));
vi.mock("react", () => ({
  useState: (init: unknown) => {
    if (!h.started) {
      h.started = true;
      h.last = init;
    }
    return [h.last, (next: unknown) => (h.last = next)];
  },
}));
vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (_query: unknown, args: unknown) => {
    h.args.push(args);
    return h.result;
  },
}));
vi.mock("../../../src/lib/useHour", () => ({ useHour: () => 7 }));

import type { FunctionReference } from "convex/server";
import { useTimedQuery } from "../../../src/lib/useTimedQuery";

const query = {} as FunctionReference<
  "query",
  "public",
  { hour?: number },
  { n: number } | null
>;

test("the last answer outlives the hour's turnover; initial only stands in before the first", () => {
  const initial = { n: 0 };
  const first = { n: 1 };
  h.result = undefined;
  expect(useTimedQuery(query, initial)).toBe(initial);
  expect(h.args).toEqual([{ hour: 7 }]);
  h.result = first;
  expect(useTimedQuery(query, initial)).toBe(first);
  // A new hour: undefined for a moment, and the page keeps what it showed.
  h.result = undefined;
  expect(useTimedQuery(query, initial)).toBe(first);
  // Null is an answer, not a gap.
  h.result = null;
  expect(useTimedQuery(query, initial)).toBeNull();
  h.result = undefined;
  expect(useTimedQuery(query, initial)).toBeNull();
});

test("without initial it is undefined until the first answer, then kept", () => {
  const first = { n: 1 };
  h.started = false;
  h.result = undefined;
  expect(useTimedQuery(query)).toBeUndefined();
  h.result = first;
  expect(useTimedQuery(query)).toBe(first);
  h.result = undefined;
  expect(useTimedQuery(query)).toBe(first);
});
