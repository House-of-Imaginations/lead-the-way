import { expect, test } from "../fixtures";
import { THEMES, gallery } from "./helpers";

for (const theme of THEMES) {
  test(`the top bar opens the navigation drawer, ${theme} @mobile`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.goto(gallery(theme));
    const bar = page.locator("#topbar .ltw-tb");
    await expect(bar).toHaveCSS("height", "48px");
    await expect(bar.getByRole("link", { name: "Lead the Way" })).toBeVisible();
    const open = bar.getByRole("button", { name: "Open menu" });
    await expect(open).toHaveAttribute("aria-expanded", "false");
    // An open Radix modal hides the rest of the page from the accessibility tree, so re-find the button by CSS.
    const trigger = bar.locator('[aria-label="Open menu"]');
    await open.click();

    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const drawerNav = drawer.getByRole("navigation", { name: "Main" });
    await expect(
      drawerNav.getByRole("link", { name: "Overview" }),
    ).toBeVisible();
    await expect(drawerNav.getByText("Week 2 of 4")).toBeVisible();
    // Drawer use: no resize handle and no Collapse row.
    await expect(drawer.getByRole("separator")).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Collapse" })).toHaveCount(
      0,
    );
    await expectAxeClean(page, '[role="dialog"]');

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
