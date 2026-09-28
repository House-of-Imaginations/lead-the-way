"use client";

import { useEffect } from "react";
import {
  applyThemeColor,
  resolveThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";

/**
 * A direct light/dark switch. Follow the system until the first explicit choice.
 *
 * `next-themes` is deliberately absent. `src/lib/theme.ts` owns the resolution
 * order in two forms (a pre-paint string and this one) with a test running them
 * against the same case table, and a third implementation is the drift that
 * file exists to stop.
 */

/**
 * The glyph is drawn rather than taken from an icon set, and lettering is not
 * an option: three different words do not fit one control. Shape carries the
 * state, not colour -- a moon, a half-lit circle, a sun -- distinguishable
 * without seeing colour at all.
 */
function Glyph({
  mode,
  className = "size-[18px]",
}: {
  mode: ThemeMode;
  className?: string;
}) {
  if (mode === "dark") {
    return (
      <svg
        viewBox="0 0 20 20"
        className={className}
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M16.3 12.9A7.2 7.2 0 0 1 7.1 3.7a7.2 7.2 0 1 0 9.2 9.2Z" />
      </svg>
    );
  }
  if (mode === "light") {
    return (
      <svg
        viewBox="0 0 20 20"
        className={className}
        aria-hidden="true"
        fill="currentColor"
      >
        <circle cx="10" cy="10" r="4.1" />
        <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M10 1.6v2.2M10 16.2v2.2M18.4 10h-2.2M3.8 10H1.6M15.9 4.1l-1.6 1.6M5.7 14.3l-1.6 1.6M15.9 15.9l-1.6-1.6M5.7 5.7 4.1 4.1" />
        </g>
      </svg>
    );
  }
  // Auto: half the roundel lit. The same "it depends" the setting means.
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M10 2.8a7.2 7.2 0 0 1 0 14.4Z" fill="currentColor" />
    </svg>
  );
}

export function ThemeToggle() {
  useEffect(() => {
    // `location.search` and `localStorage` do not exist while this renders on
    // the server, so this read cannot move into the render body or a useState
    // initialiser: the hydration render has to produce what the server sent,
    // which is "system". Nothing downstream depends on the value -- the DOM is
    // already in the right mode, because the pre-paint script in `@/lib/theme`
    // set `data-theme` before anything was drawn, resolving through the same
    // `resolveThemeMode` so the two cannot disagree.
    let resolved: ThemeMode = "system";
    try {
      resolved = resolveThemeMode(
        new URLSearchParams(location.search).get("theme"),
        localStorage.getItem(THEME_STORAGE_KEY),
      );
    } catch {
      // No URL and no store to read (Safari's "Block All Cookies", some
      // embedded webviews). Whatever the OS says, then.
    }
    // Re-apply the attribute the pre-paint script set. A no-op in production,
    // where nothing has cleared it. In development, React's Strict Mode
    // remounts once and resets <html> to only the attributes it owns from JSX,
    // dropping `data-theme` -- so a stored "light" silently reverted to the OS
    // mode a moment after load, with this control still (correctly) showing Day.
    try {
      const root = document.documentElement;
      if (resolved === "system") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", resolved);
    } catch {
      // Nothing to recover: the page keeps whatever mode it painted in.
    }

    // In "system" the browser's own furniture has to follow the OS the way the
    // stylesheet already does: `prefers-color-scheme` re-resolves `--ground` by
    // itself, but the `theme-color` meta is a fixed string and would sit at
    // last night's colour when the phone flips to Day at sunrise with the tab
    // still open. Only "system" listens -- an explicit choice is not the OS's
    // to change.
    if (resolved !== "system") return;
    try {
      const query = matchMedia("(prefers-color-scheme: light)");
      const sync = () => {
        if (!document.documentElement.hasAttribute("data-theme"))
          applyThemeColor("system");
      };
      query.addEventListener("change", sync);
      return () => query.removeEventListener("change", sync);
    } catch {
      // No matchMedia (or it is locked down): the tint stays where the
      // pre-paint script put it, which is right for the mode the page loaded in.
    }
  }, []);

  function choose(next: ThemeMode) {
    const root = document.documentElement;
    // The browser's status bar and title bar are part of this switch's job:
    // leave them and picking Day on a dark phone paints a paper-white page
    // under a Harbour Night status bar.
    applyThemeColor(next);
    try {
      if (next === "system") {
        root.removeAttribute("data-theme");
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        root.setAttribute("data-theme", next);
        localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // The mode still changed for this page; only remembering it is lost.
      if (next === "system") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", next);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-touch"
      onClick={() => {
        const current = document.documentElement.getAttribute("data-theme");
        const dark =
          current === "dark" ||
          (!current && matchMedia("(prefers-color-scheme: dark)").matches);
        choose(dark ? "light" : "dark");
      }}
    >
      <span className="dark:hidden">
        <Glyph mode="dark" />
        <span className="sr-only">Switch to dark mode</span>
      </span>
      <span className="hidden dark:block">
        <Glyph mode="light" />
        <span className="sr-only">Switch to light mode</span>
      </span>
    </Button>
  );
}
