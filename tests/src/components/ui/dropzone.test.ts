import { expect, test } from "vitest";
import { accepts } from "@/components/ui/dropzone";

const file = (name: string, type: string) => new File(["x"], name, { type });

test("accepts matches extensions, wildcards and exact types", () => {
  expect(accepts(file("RO.PDF", "application/pdf"), ".pdf,.png")).toBe(true);
  expect(accepts(file("a.jpg", "image/jpeg"), "image/*")).toBe(true);
  expect(accepts(file("a.txt", "text/plain"), "image/*")).toBe(false);
  expect(accepts(file("a.csv", "text/csv"), "text/csv")).toBe(true);
  expect(accepts(file("a.exe", ""), undefined)).toBe(true);
});
