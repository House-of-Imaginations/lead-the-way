"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { msToNextHour } from "@/lib/hour";

/**
 * Ruling 14: at the top of each hour, re-run the server reads. They send the
 * new `hour` to Convex, so "which week" and "next protected hour" come back
 * fresh without a reload by hand.
 * ponytail: fires 5 s after the hour, so a browser clock that runs a little fast
 * still reaches the server in its new hour. A clock fast by more than that
 * refreshes an hour late.
 */
export function HourlyRefresh() {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(
        () => {
          router.refresh();
          arm();
        },
        msToNextHour(Date.now()) + 5_000,
      );
    };
    arm();
    return () => clearTimeout(timer);
  }, [router]);
  return null;
}
