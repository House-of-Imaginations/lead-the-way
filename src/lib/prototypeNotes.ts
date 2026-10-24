"use client";

import { useSyncExternalStore } from "react";

// Spec 3.2: off by default, remembered per browser. Storage can be missing or
// throw (private windows, blocked site data), which reads as off.
// ponytail: where storage throws, the toggle can't turn on (read stays false);
// add an in-memory fallback if that ever matters.
const KEY = "ltw-prototype-notes";
const CHANGE = "ltw-prototype-notes-change";

function read() {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function usePrototypeNotes(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setPrototypeNotes(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "on");
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered. The event below still fires, but read() goes back to
    // the storage that threw, so the toggle stays off (see the note above).
  }
  window.dispatchEvent(new Event(CHANGE));
}
