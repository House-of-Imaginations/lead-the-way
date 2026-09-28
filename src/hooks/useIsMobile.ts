import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Is this a phone-width viewport?
 *
 * shadcn ships this as `useState` + `useEffect`, which sets state during the
 * effect on every mount -- a cascading render `react-hooks/set-state-in-effect`
 * fails as an error here. `useSyncExternalStore` is what the hook is actually
 * doing: reading an external, subscribable value. The server snapshot is
 * `false`, so the first paint is the desktop layout and the sidebar hydrates
 * into its drawer form rather than the markup claiming a width the server
 * cannot know.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
