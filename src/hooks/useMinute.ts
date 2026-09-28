"use client";

import { useSyncExternalStore } from "react";

/**
 * The clock to the minute, for labels like "12 min ago".
 *
 * `useNow` ticks four times a second for countdowns; a list of relative times
 * only changes once a minute, so it re-renders once a minute. The server
 * snapshot is 0, which the first client check replaces.
 */
const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  // The first check is immediate: after hydration React keeps the server
  // snapshot until something re-renders, and nothing may for a while.
  const first = window.setTimeout(onChange, 0);
  const id = window.setInterval(onChange, 5_000);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(id);
  };
}
const snapshot = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const serverSnapshot = () => 0;

export function useMinute(): number {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
