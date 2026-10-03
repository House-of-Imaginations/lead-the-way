import { useEffect, useState } from "react";
import { hourOf, msToNextHour } from "./hour";

/**
 * Ruling 16: the `hour` a client sends to a timed query. It changes 5 s after
 * each top of the hour (as `HourlyRefresh` does), so the query is new and
 * Convex reads the clock again without a reload.
 */
export function useHour(): number {
  const [hour, setHour] = useState(() => hourOf(Date.now()));
  useEffect(() => {
    const timer = setTimeout(
      () => setHour(hourOf(Date.now())),
      msToNextHour(Date.now()) + 5_000,
    );
    return () => clearTimeout(timer);
  }, [hour]);
  return hour;
}
