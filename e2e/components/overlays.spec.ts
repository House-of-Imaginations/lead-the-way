import { expect, test } from "../fixtures";
import { THEMES, TOKENS, expectedRing, focusRing, gallery } from "./helpers";

for (const theme of THEMES) {
  test.describe(`overlays, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("the modal traps focus and passes axe @mobile", async ({
      page,
      expectAxeClean,
    }) => {
      await page
        .locator("#overlays")
        .getByRole("button", { name: "Open dialog" })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Single sign-on isn't set up",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".ltw-modal-f .ltw-btn")).toHaveText([
        "Cancel",
        "Use email",
      ]);
      await expect(dialog.locator(".ltw-modal-f .ltw-btn").first()).toHaveCSS(
        "height",
        "64px",
      );
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Tab");
        expect(
          await dialog.evaluate((d) => d.contains(document.activeElement)),
        ).toBe(true);
      }
      await expectAxeClean(page, '[role="dialog"]');
    });

    test("the modal has its scrim, panel, close button and footer", async ({
      page,
    }) => {
      const trigger = page
        .locator("#overlays")
        .getByRole("button", { name: "Open dialog" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page.locator(".ltw-scrim")).toHaveCSS(
        "background-color",
        "rgba(22, 22, 22, 0.5)",
      );
      await expect(dialog).toHaveCSS("max-width", "560px");
      await expect(dialog).toHaveCSS("background-color", TOKENS[theme].layer01);
      await expect(dialog).toHaveCSS(
        "box-shadow",
        "rgba(0, 0, 0, 0.3) 0px 2px 6px 0px",
      );
      await expect(dialog.locator(".ltw-modal-b")).toHaveCSS(
        "padding-bottom",
        "48px",
      );
      const close = dialog.getByRole("button", { name: "Close" });
      const size = (await close.boundingBox())!;
      expect([Math.round(size.width), Math.round(size.height)]).toEqual([
        48, 48,
      ]);
      const [a, b] = await dialog.locator(".ltw-modal-f .ltw-btn").all();
      const left = (await a.boundingBox())!;
      const right = (await b.boundingBox())!;
      expect(right.x - (left.x + left.width)).toBeCloseTo(0, 0);
      expect(await focusRing(close)).toEqual(expectedRing(theme));
    });

    test("tall modal content scrolls inside the panel", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 200 });
      await page
        .locator("#overlays")
        .getByRole("button", { name: "Open dialog" })
        .click();
      const dialog = page.getByRole("dialog");
      const box = (await dialog.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(200);
    });

    test("Escape closes the modal and returns focus", async ({ page }) => {
      const trigger = page
        .locator("#overlays")
        .getByRole("button", { name: "Open dialog" });
      await trigger.click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    test("Cancel closes and the primary action runs", async ({ page }) => {
      const overlays = page.locator("#overlays");
      const trigger = overlays.getByRole("button", { name: "Open dialog" });
      await trigger.click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Use email" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(overlays.getByText("Last action: Use email")).toBeVisible();
      await expect(trigger).toBeFocused();
    });

    test("a passive modal has only the close button", async ({ page }) => {
      await page
        .locator("#overlays")
        .getByRole("button", { name: "Open transcript" })
        .click();
      const dialog = page.getByRole("dialog", { name: "Transcript" });
      await expect(dialog.locator(".ltw-modal-f")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toHaveCount(0);
    });

    test("a menu link navigates on Enter", async ({ page }) => {
      const trigger = page
        .locator("#overlays")
        .getByRole("button", { name: "Show actions" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("menuitem", { name: "Settings", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#overlays$/);
    });

    test("the account menu opens upward", async ({ page }) => {
      const trigger = page
        .locator("#overlays")
        .getByRole("button", { name: "Open account" });
      const t = (await trigger.boundingBox())!;
      await trigger.focus();
      await page.keyboard.press("Enter");
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      const m = (await menu.boundingBox())!;
      expect(m.y + m.height).toBeLessThanOrEqual(t.y);
    });

    test("menu is keyboard operable and returns focus", async ({
      page,
      expectAxeClean,
    }) => {
      const overlays = page.locator("#overlays");
      const trigger = overlays.getByRole("button", { name: "Show actions" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await expect(menu).toHaveCSS(
        "box-shadow",
        "rgba(0, 0, 0, 0.3) 0px 2px 6px 0px",
      );
      await expect(
        menu.getByRole("menuitem", { name: /Workspace settings/ }),
      ).toHaveAttribute("aria-disabled", "true");
      await expect(menu.getByText("Managed by Priya Raman")).toBeVisible();
      await expectAxeClean(page, '[role="menu"]');
      const first = menu.getByRole("menuitem", {
        name: "Settings",
        exact: true,
      });
      await expect(first).toBeFocused();
      await expect(first).toHaveAttribute("data-highlighted", "");
      await expect(first).toHaveCSS(
        "background-color",
        TOKENS[theme].layerHover,
      );
      expect(await focusRing(first)).toEqual(expectedRing(theme));
      await page.keyboard.press("ArrowDown"); // skips the disabled item
      await expect(
        menu.getByRole("menuitem", { name: "Sign out" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(menu).toHaveCount(0);
      await expect(overlays.getByText("Last action: Sign out")).toBeVisible();
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  });
}
