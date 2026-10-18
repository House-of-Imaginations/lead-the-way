import { expect, test } from "vitest";
import { DEMO_TARGETS } from "../../../../convex/lib/demo/schedule";
import { forwardTargets } from "../../../../src/lib/demo/targets";

test("at setup every later target is offered, labelled with its time", () => {
  expect(forwardTargets(DEMO_TARGETS.setup)).toEqual([
    { target: "week1", label: "Week 1, Wed 9 Sep, 1:00 PM" },
    { target: "week2", label: "Week 2, Wed 16 Sep, 1:00 PM" },
    { target: "week3", label: "Week 3, Wed 23 Sep, 1:00 PM" },
    { target: "week4", label: "Week 4, Wed 30 Sep, 1:00 PM" },
    { target: "complete", label: "Sprint complete" },
  ]);
});

test("the current target and earlier ones are not offered", () => {
  expect(forwardTargets(DEMO_TARGETS.week3).map((t) => t.target)).toEqual([
    "week4",
    "complete",
  ]);
  expect(forwardTargets(DEMO_TARGETS.complete)).toEqual([]);
});
