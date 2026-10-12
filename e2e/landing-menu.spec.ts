import { expect, test } from "./fixtures";

// The menu is below 1057px; pin the phone width so the desktop project runs it too.
test.use({ viewport: { width: 390, height: 844 } });

const htmlOverflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.style.overflow);

test("the menu opens, traps focus, closes on Escape and gives focus back", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).focus();
  await page.keyboard.press("Enter");

  const menu = page.getByRole("dialog", { name: "Menu" });
  const close = page.getByRole("button", { name: "Close menu" });
  await expect(menu).toBeVisible();
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("link", { name: /^Overview/ })).toBeFocused();
  await expect(page.locator(".lp > main")).toHaveAttribute("inert", "");
  await expect(page.locator(".lp > footer")).toHaveAttribute("inert", "");
  expect(await htmlOverflow(page)).toBe("hidden");

  // Tab past the last link wraps to the toggle; Shift+Tab wraps back.
  const links = menu.getByRole("link");
  const count = await links.count();
  for (let i = 1; i < count; i++) await page.keyboard.press("Tab");
  await expect(links.last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(links.last()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await expect(page.locator(".lp > main")).not.toHaveAttribute("inert");
  await expect(page.locator(".lp > footer")).not.toHaveAttribute("inert");
  expect(await htmlOverflow(page)).toBe("");
});

test("choosing a section closes the menu and goes there", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("dialog", { name: "Menu" })
    .getByRole("link", { name: /^Privacy/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  await expect(page).toHaveURL(/#privacy$/);
  await expect(
    page.getByRole("heading", {
      name: "You see the team, never the individual.",
    }),
  ).toBeInViewport();
});

test("leaving through the menu leaves the next page scrollable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("dialog", { name: "Menu" })
    .getByRole("link", { name: "Start your sprint" })
    .click();
  await expect(page).toHaveURL("/signup");
  expect(await htmlOverflow(page)).toBe("");
});

test("the menu offers the calls to action, Log in and the disclaimer", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(
    menu.getByRole("link", { name: "See the prototype" }),
  ).toHaveAttribute("href", "/login");
  await expect(
    menu.getByRole("link", { name: "Start your sprint" }),
  ).toHaveAttribute("href", "/signup");
  await expect(
    menu.getByRole("link", { name: "Log in", exact: true }),
  ).toHaveAttribute("href", "/login");
  await expect(
    menu.getByText("Concept prototype. Not an official IBM product."),
  ).toBeVisible();
});

test("widening the window closes the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await page.setViewportSize({ width: 1200, height: 844 });
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  await expect(page.locator(".lp > main")).not.toHaveAttribute("inert");
  expect(await htmlOverflow(page)).toBe("");
});
