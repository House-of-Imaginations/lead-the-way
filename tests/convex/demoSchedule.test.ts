import { expect, test } from "vitest";
import { DEMO_NOW, DEMO_TIME_ZONE } from "../../convex/lib/demo/schedule";
import { weekOneDate } from "../../convex/lib/sprintTime";

// The script's priya.launch keeps the seed's 9 September. That equals
// weekOneDate at the setup time only while the clock starts on 1 September:
// a launch on 7 or 8 September would give 16 September (roadmap, P4 note).
test("week one of the demo starts on Wednesday 9 September", () => {
  expect(weekOneDate(3, DEMO_NOW, DEMO_TIME_ZONE)).toBe("2026-09-09");
});
