import { expect, test } from "../fixtures";
import { THEMES, TOKENS, expectedRing, focusRing, gallery } from "./helpers";

for (const theme of THEMES) {
  test(`gallery renders on the tokens with the disclaimer, ${theme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.goto(gallery(theme));
    await expect(
      page.getByRole("heading", { level: 1, name: "Components" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("contentinfo")
        .getByText("Concept prototype. Not an official IBM product."),
    ).toBeVisible();
    await expectAxeClean(page);
  });

  test(`a link styled only with utilities gets the double ring, ${theme}`, async ({
    page,
  }) => {
    await page.goto(gallery(theme));
    const link = page
      .getByRole("main")
      .getByRole("link", { name: theme, exact: true });
    expect(await focusRing(link)).toEqual(expectedRing(theme));
  });

  test(`logo is the held hour, ${theme}`, async ({ page }) => {
    await page.goto(gallery(theme));
    const logo = page.locator("#logo svg.ltw-logo").first();
    await expect(logo).toHaveAttribute("aria-hidden", "true");
    await expect(logo).toHaveCSS("width", "24px");
    // Brackets follow the text colour; the held block is always the accent.
    await expect(logo.locator("path")).toHaveCSS(
      "fill",
      TOKENS[theme].textPrimary,
    );
    await expect(logo.locator("rect")).toHaveCSS(
      "fill",
      TOKENS[theme].interactive,
    );
  });

  test(`the gallery never scrolls sideways (only tables may), ${theme} @mobile`, async ({
    page,
  }) => {
    await page.goto(gallery(theme));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
