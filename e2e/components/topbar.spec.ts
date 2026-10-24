import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { THEMES, TOKENS, expectedRing, focusRing, gallery } from "./helpers";

async function openDrawer(page: Page) {
  await page
    .locator("#topbar .ltw-tb")
    .getByRole("button", { name: "Open menu" })
    .click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  return drawer;
}

for (const theme of THEMES) {
  test(`the top bar opens the navigation drawer, ${theme} @mobile`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(gallery(theme));
    const bar = page.locator("#topbar .ltw-tb");
    await expect(bar).toHaveCSS("height", "48px");
    await expect(
      bar.getByRole("link", { name: "From Zero to Hero" }),
    ).toBeVisible();
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

for (const theme of THEMES) {
  test(`the top bar reads menu, brand, avatar, as on M2, ${theme} @mobile`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(gallery(theme));
    const bar = page.locator("#topbar .ltw-tb");
    const menu = bar.getByRole("button", { name: "Open menu" });
    const brand = bar.getByRole("link", { name: "From Zero to Hero" });
    const avatar = bar.getByRole("button", { name: "Priya Raman" });
    const barBox = (await bar.boundingBox())!;
    const [m, b, a] = [
      (await menu.boundingBox())!,
      (await brand.boundingBox())!,
      (await avatar.boundingBox())!,
    ];
    // Menu flush left, brand next, avatar flush right; every tap target 48px.
    expect(m.x).toBe(barBox.x);
    expect(b.x).toBeGreaterThanOrEqual(m.x + m.width);
    expect(a.x + a.width).toBe(barBox.x + barBox.width);
    for (const box of [m, b, a]) expect(box.height).toBe(48);
    expect([m.width, a.width]).toEqual([48, 48]);
    await expect(avatar.locator(".ltw-av")).toHaveCSS("width", "32px");
    await expect(bar).toHaveCSS("background-color", TOKENS[theme].background);
    await expect(bar).toHaveCSS(
      "border-bottom-color",
      TOKENS[theme].borderSubtle,
    );
    await expectAxeClean(page, "#topbar");

    await avatar.click();
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
    await expectAxeClean(page, '[role="menu"]');
  });

  test(`the drawer's close button closes it and returns focus, ${theme} @mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(gallery(theme));
    // Found by CSS: the open drawer hides the page from the accessibility tree.
    const trigger = page.locator('#topbar [aria-label="Open menu"]');
    const drawer = await openDrawer(page);
    const close = drawer.getByRole("button", { name: "Close menu" });
    const box = (await close.boundingBox())!;
    expect([Math.round(box.width), Math.round(box.height)]).toEqual([48, 48]);
    // Keyboard focus, so the ring shows (see helpers.ts).
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await focusRing(close)).toEqual(expectedRing(theme));
    await close.click();
    await expect(drawer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test("following a link in the drawer closes it @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(gallery("light"));
  const drawer = await openDrawer(page);
  await drawer.getByRole("link", { name: "Sprint" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("drawer links are 48px touch targets on phones @mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(gallery("light"));
  const drawer = await openDrawer(page);
  await expect(drawer.getByRole("link", { name: "Overview" })).toHaveCSS(
    "height",
    "48px",
  );
});

test("the drawer scrolls on a short screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await page.goto(gallery("light"));
  const drawer = await openDrawer(page);
  // Rows keep their 48px phone height instead of squashing to fit.
  await expect(drawer.getByRole("link", { name: "Overview" })).toHaveCSS(
    "height",
    "48px",
  );
  const disclaimer = drawer.getByText(
    "Concept prototype. Not an official IBM product.",
  );
  await disclaimer.scrollIntoViewIfNeeded();
  await expect(disclaimer).toBeInViewport({ ratio: 1 });
});
