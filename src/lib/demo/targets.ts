import {
  DEMO_TARGETS,
  DEMO_TIME_ZONE,
  type DemoTarget,
} from "@convex/lib/demo/schedule";
import { hourLabel } from "@convex/lib/sprintTime";

const NAMES: Record<Exclude<DemoTarget, "setup">, string> = {
  week1: "Week 1",
  week2: "Week 2",
  week3: "Week 3",
  week4: "Week 4",
  complete: "Sprint complete",
};

/**
 * Where the demo clock can go from `demoNow`: forward only (a reset goes back).
 * "Sprint complete" has no date: it lands an hour after the close (R10).
 */
export function forwardTargets(demoNow: number) {
  return (Object.keys(NAMES) as (keyof typeof NAMES)[])
    .filter((target) => DEMO_TARGETS[target] > demoNow)
    .map((target) => ({
      target: target as DemoTarget,
      label:
        target === "complete"
          ? NAMES[target]
          : `${NAMES[target]}, ${hourLabel(DEMO_TARGETS[target], DEMO_TIME_ZONE)}`,
    }));
}
