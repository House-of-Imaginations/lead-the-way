// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { reduceMotion } from "../../../src/lib/motion";

function stub(attribute: boolean, osReduce: boolean) {
  vi.stubGlobal("document", {
    documentElement: {
      hasAttribute: (name: string) =>
        attribute && name === "data-reduce-motion",
    },
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: osReduce && query === "(prefers-reduced-motion: reduce)",
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("R4: motion is reduced by the OS setting or by Settings' Reduce motion", () => {
  stub(false, false);
  expect(reduceMotion()).toBe(false);
  stub(true, false);
  expect(reduceMotion()).toBe(true);
  stub(false, true);
  expect(reduceMotion()).toBe(true);
  stub(true, true);
  expect(reduceMotion()).toBe(true);
});
