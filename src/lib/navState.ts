/**
 * The side nav's saved width and rail, in a cookie so the server can paint
 * the first frame right (Ruling 10). `w320` is expanded at 320px, `c320` is the
 * rail with 320px to come back to.
 */
export const NAV_COOKIE = "ltw-sidenav";
export const NAV = { rail: 48, min: 200, max: 400, default: 256 } as const;
export type NavState = { width: number; collapsed: boolean };

export const clampWidth = (width: number) =>
  Math.min(NAV.max, Math.max(NAV.min, Math.round(width)));

export function parseNav(raw: string | null | undefined): NavState | null {
  const match = raw?.match(/^([wc])(\d{1,4})$/);
  if (!match) return null;
  return { collapsed: match[1] === "c", width: clampWidth(Number(match[2])) };
}

export const serializeNav = ({ width, collapsed }: NavState) =>
  `${collapsed ? "c" : "w"}${width}`;
