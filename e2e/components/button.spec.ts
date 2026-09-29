import { expect, test } from "../fixtures";
import { THEMES, expectedRing, focusRing, gallery } from "./helpers";

for (const theme of THEMES) {
  test.describe(`buttons, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("focus ring is visible on filled buttons in both themes", async ({
      page,
    }) => {
      const buttons = page.locator("#buttons");
      const targets = [
        buttons.getByRole("button", { name: "Save agreement" }), // primary, interactive fill
        buttons.getByRole("button", { name: "Back" }), // secondary, button-secondary fill
        page.getByTestId("inverse").getByRole("button", { name: "Test focus" }), // layer-inverse surface
      ];
      for (const target of targets) {
        expect(await focusRing(target)).toEqual(expectedRing(theme));
      }
    });

    test("kinds and sizes follow the bundle", async ({ page }) => {
      const buttons = page.locator("#buttons");
      const cases: Array<[string, string, string]> = [
        ["Save agreement", "ltw-btn-primary", "48px"],
        ["Back", "ltw-btn-secondary", "48px"],
        ["Download summary", "ltw-btn-tertiary", "48px"],
        ["View all", "ltw-btn-ghost", "48px"],
        ["Remove member", "ltw-btn-danger", "48px"],
        ["Add", "ltw-btn-md", "40px"],
        ["Edit", "ltw-btn-sm", "32px"],
        ["Continue", "ltw-btn-xl", "64px"],
      ];
      for (const [name, cls, height] of cases) {
        const button = buttons.getByRole("button", { name, exact: true });
        await expect(button).toHaveClass(new RegExp(`\\b${cls}\\b`));
        await expect(button).toHaveCSS("height", height);
        await expect(button).toHaveCSS("border-radius", "0px");
      }
    });

    test("the icon sits right of the label and is hidden from assistive tech", async ({
      page,
    }) => {
      const button = page
        .locator("#buttons")
        .getByRole("button", { name: "Save agreement" });
      const label = await button.locator("span").boundingBox();
      const icon = button.locator("svg");
      await expect(icon).toHaveAttribute("aria-hidden", "true");
      expect((await icon.boundingBox())!.x).toBeGreaterThan(
        label!.x + label!.width,
      );
    });

    test("a disabled button says why nearby", async ({ page }) => {
      const buttons = page.locator("#buttons");
      await expect(
        buttons.getByRole("button", { name: "Save project" }),
      ).toBeDisabled();
      await expect(
        buttons.getByText("Tick both safety checks to save your project."),
      ).toBeVisible();
    });

    test("a button link is a link styled as a button", async ({ page }) => {
      const link = page
        .locator("#buttons")
        .getByRole("link", { name: "Jump to buttons" });
      await expect(link).toHaveClass(/\bltw-btn\b/);
      await expect(link).toHaveAttribute("href", "/dev/components#buttons");
    });

    test("buttons pass axe", async ({ page, expectAxeClean }) => {
      await expectAxeClean(page, "#buttons");
    });
  });
}
