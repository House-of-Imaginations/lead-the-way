export type NavId = "dashboard";
export type NavItem = { id: NavId; title: string; url: string };

// An item shows when the seat holds any one of its permissions; empty means everyone.
const NAV: { item: NavItem; anyOf: string[] }[] = [
  {
    item: { id: "dashboard", title: "Dashboard", url: "/dashboard" },
    anyOf: [],
  },
];

export function mainNav(permissions: readonly string[]): NavItem[] {
  return NAV.filter(
    ({ anyOf }) => !anyOf.length || anyOf.some((p) => permissions.includes(p)),
  ).map(({ item }) => item);
}

/** Prefix match on whole segments, so a nested page keeps its parent lit. */
export const isNavActive = (pathname: string, url: string) =>
  pathname === url || pathname.startsWith(`${url}/`);
