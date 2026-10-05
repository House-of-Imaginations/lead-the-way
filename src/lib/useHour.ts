import { useEffect, useState } from "react";
import { hourOf, msToNextHour } from "./hour";

/**
 * Ruling 16: the `hour` a client sends to a timed query. It changes 5 s after
 * each top of the hour (as `HourlyRefresh` does), so the query is new and
 * Convex reads the clock again without a reload. Subscribe with
 * `useTimedQuery`, which keeps the last answer over the turnover.
 */
export function useHour(): number {
  const [hour, setHour] = useState(() => hourOf(Date.now()));
  // Bumped on every fire, so the timer re-arms even if the hour did not move.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setHour(hourOf(Date.now()));
        setTick((t) => t + 1);
      },
      msToNextHour(Date.now()) + 5_000,
    );
    return () => clearTimeout(timer);
  }, [tick]);
  return hour;
}
