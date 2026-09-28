import { expect, test } from "vitest";
import { isNavActive, mainNav } from "@/lib/nav";

test("an item with no permissions shows for everyone", () => {
  expect(mainNav([]).map((n) => n.id)).toEqual(["dashboard"]);
});

test("an area stays lit on its sub-pages but not on a sibling prefix", () => {
  expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
  expect(isNavActive("/dashboard/abc", "/dashboard")).toBe(true);
  expect(isNavActive("/dashboardx", "/dashboard")).toBe(false);
  expect(isNavActive("/settings", "/dashboard")).toBe(false);
});
