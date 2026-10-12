/**
 * Reduce motion (R4): the OS setting, or Settings' Reduce motion, which the
 * app shell writes as `data-reduce-motion` on <html>.
 *
 * ponytail: on "/" the attribute is effectively never there (only the app
 * layout and AppShell set it, and AppShell removes it on unmount). Mirroring
 * the setting into localStorage, as the theme is, would let "/" see it (P10).
 * One path does bring it: the app's closed redirect sends a person from the
 * app to "/" with it still set, and AppShell drops it after "/" has painted.
 * LandingMotion reads it at hydration and leaves `data-motion="off"`, and
 * landing.css's `.lp[data-motion="off"]` rule then keeps the CSS entrance off
 * too, so dropping the attribute later starts nothing.
 */
export function reduceMotion(): boolean {
  return (
    document.documentElement.hasAttribute("data-reduce-motion") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
