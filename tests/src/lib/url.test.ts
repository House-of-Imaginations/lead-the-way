import { expect, test } from "vitest";
import { withParams } from "@/lib/url";

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
