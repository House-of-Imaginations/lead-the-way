import { expect, test } from "vitest";
import { safeNext, withParams } from "@/lib/url";

test("sets, replaces and removes keys, keeping the rest", () => {
  expect(
    withParams("/claims", "stage=OEM_REVIEW&x=1", { stage: "APPROVED" }),
  ).toBe("/claims?stage=APPROVED&x=1");
  expect(withParams("/claims", "stage=OEM_REVIEW", { stage: null })).toBe(
    "/claims",
  );
  expect(withParams("/claims", "", { dealership: "d1", stage: "" })).toBe(
    "/claims?dealership=d1",
  );
});

test("safeNext keeps same-site paths only", () => {
  expect(safeNext("/manager")).toBe("/manager");
  expect(safeNext("/manager/outcomes?week=2#top")).toBe(
    "/manager/outcomes?week=2#top",
  );
  for (const bad of [
    null,
    undefined,
    "",
    "manager",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
  ]) {
    expect(safeNext(bad), JSON.stringify(bad)).toBeNull();
  }
});
