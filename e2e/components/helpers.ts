import type { Locator } from "@playwright/test";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Token values as the browser reports computed colours. From src/styles/tokens.css. */
export const TOKENS = {
  light: {
    focus: "rgb(15, 98, 254)",
    background: "rgb(255, 255, 255)",
    textPrimary: "rgb(22, 22, 22)",
    interactive: "rgb(15, 98, 254)",
    supportError: "rgb(218, 30, 40)",
    supportSuccess: "rgb(36, 161, 72)",
    layer01: "rgb(244, 244, 244)",
    layerHover: "rgb(232, 232, 232)",
    layerInverse: "rgb(57, 57, 57)",
  },
  dark: {
    focus: "rgb(255, 255, 255)",
    background: "rgb(22, 22, 22)",
    textPrimary: "rgb(244, 244, 244)",
    interactive: "rgb(15, 98, 254)",
    supportError: "rgb(250, 77, 86)",
    supportSuccess: "rgb(66, 190, 101)",
    layer01: "rgb(38, 38, 38)",
    layerHover: "rgb(51, 51, 51)",
    layerInverse: "rgb(244, 244, 244)",
  },
} as const;

export const gallery = (theme: Theme) => `/dev/components?theme=${theme}`;

/**
 * Focuses the element and reads its ring. Chromium treats script focus as
 * keyboard focus (so :focus-visible matches) only before any mouse click in the
 * test, or right after a keyboard action. Call it on a fresh page or after a
 * key press, never after a click.
 */
export async function focusRing(target: Locator) {
  await target.focus();
  return target.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      focusVisible: el.matches(":focus-visible"),
      outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
      offset: s.outlineOffset,
      boxShadow: s.boxShadow,
    };
  });
}

/** The Carbon double ring: a 2px focus outline inset, then 1px of page background inside it. */
export function expectedRing(theme: Theme) {
  return {
    focusVisible: true,
    outline: `2px solid ${TOKENS[theme].focus}`,
    offset: "-2px",
    boxShadow: `${TOKENS[theme].background} 0px 0px 0px 3px inset`,
  };
}
