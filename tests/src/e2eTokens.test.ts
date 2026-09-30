import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { TOKENS } from "../../e2e/components/helpers";

/**
 * The e2e specs assert colours from `TOKENS`. If a token changes in
 * tokens.css and not there, the specs pass against the old colour. Read off
 * disk: a CSS import is an empty string under Vitest.
 */
const css = readFileSync(
  new URL("../../src/styles/tokens.css", import.meta.url),
  "utf8",
);

function block(theme: "light" | "dark") {
  return theme === "light"
    ? css.slice(0, css.indexOf("@media"))
    : css.slice(css.indexOf(':root[data-theme="dark"]'));
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}

const kebab = (name: string) =>
  name.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();

test("the e2e TOKENS match tokens.css in both themes", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const [name, value] of Object.entries(TOKENS[theme])) {
      const re = new RegExp(`--${kebab(name)}:\\s*(#[0-9a-fA-F]{6})`);
      // The dark block only restates what changes; the rest is light's.
      const hex = (re.exec(block(theme)) ?? re.exec(block("light")))?.[1];
      expect(hex, `${theme} ${name}`).toBeDefined();
      expect(value, `${theme} ${name}`).toBe(rgb(hex!));
    }
  }
});
