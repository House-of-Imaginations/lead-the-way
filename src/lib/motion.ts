/**
 * Reduce motion (R4): the OS setting, or Settings' Reduce motion, which the
 * app shell writes as `data-reduce-motion` on <html>.
 *
 * ponytail: on "/" the attribute is effectively never there (only the app
 * layout and AppShell set it, and AppShell removes it on unmount). Mirroring
 * the setting into localStorage, as the theme is, would let "/" see it.
 */
export function reduceMotion(): boolean {
  return (
    document.documentElement.hasAttribute("data-reduce-motion") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
