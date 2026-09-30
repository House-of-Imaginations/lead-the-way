import { expect, test } from "vitest";
import { parseNav, serializeNav } from "../../../src/lib/navState";

test("the nav cookie round-trips and refuses anything else", () => {
  expect(parseNav("w320")).toEqual({ width: 320, collapsed: false });
  expect(parseNav("c300")).toEqual({ width: 300, collapsed: true });
  expect(serializeNav({ width: 272, collapsed: false })).toBe("w272");
  // Clamped to 200 to 400, so a hand-edited cookie can't break the layout.
  expect(parseNav("w9999")).toEqual({ width: 400, collapsed: false });
  expect(parseNav("w12")).toEqual({ width: 200, collapsed: false });
  for (const bad of [
    undefined,
    null,
    "",
    "x300",
    "w",
    "w30px",
    '{"width":300}',
  ]) {
    expect(parseNav(bad), String(bad)).toBeNull();
  }
});
