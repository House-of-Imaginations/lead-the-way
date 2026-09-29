import { expect, test } from "../fixtures";
import { THEMES, TOKENS, expectedRing, focusRing, gallery } from "./helpers";

for (const theme of THEMES) {
  test.describe(`toast, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("a toast confirms the action top-right and closes @mobile", async ({
      page,
    }) => {
      await page
        .locator("#toast")
        .getByRole("button", { name: "Send invitations" })
        .click();
      const toast = page.locator(".ltw-toast");
      await expect(toast).toContainText("Invitations sent to 8 team members.");
      await expect(toast).toHaveCSS(
        "box-shadow",
        "rgba(0, 0, 0, 0.3) 0px 2px 6px 0px",
      );
      const box = (await toast.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(Math.round(box.x + box.width)).toBe(viewport.width - 16);
      expect(Math.round(box.y)).toBe(16);
      await expect(toast).toHaveCSS("width", "320px");
      await expect(toast).toHaveCSS(
        "border-left-color",
        TOKENS[theme].supportSuccess,
      );
      await expect(toast).toHaveCSS(
        "background-color",
        TOKENS[theme].layerInverse,
      );
      await toast.getByRole("button", { name: "Close" }).click();
      await expect(toast).toHaveCount(0);
    });

    test("the close button on the inverse toast shows the focus ring", async ({
      page,
    }) => {
      // Keyboard only, so script focus stays :focus-visible (see helpers.ts).
      const send = page
        .locator("#toast")
        .getByRole("button", { name: "Send invitations" });
      await send.focus();
      await page.keyboard.press("Enter");
      const close = page
        .locator(".ltw-toast")
        .getByRole("button", { name: "Close" });
      expect(await focusRing(close)).toEqual(expectedRing(theme));
    });

    test("a toast dismisses itself after five seconds", async ({ page }) => {
      await page.clock.install();
      await page.goto(gallery(theme));
      await page
        .locator("#toast")
        .getByRole("button", { name: "Send invitations" })
        .click();
      const toast = page.locator(".ltw-toast");
      await expect(toast).toBeVisible();
      await page.clock.runFor(4900);
      await expect(toast).toBeVisible();
      await page.clock.runFor(200);
      await expect(toast).toHaveCount(0);
    });

    test("a toast can carry a body line", async ({ page, expectAxeClean }) => {
      await page
        .locator("#toast")
        .getByRole("button", { name: "Save agreement" })
        .click();
      const toast = page.locator(".ltw-toast");
      await expect(toast.locator(".ltw-toast-t")).toHaveText("Saved.");
      await expect(toast.locator(".ltw-toast-d")).toHaveText(
        "Your team now has a shared AI working agreement.",
      );
      await expectAxeClean(page, ".ltw-toast-vp");
    });
  });
}
