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

test("Tab right after Escape stays out of the closing menu", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("link", { name: /^Overview/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.getElementById("mnav")?.contains(document.activeElement),
    ),
  ).toBe(false);
});

test.describe("on a short screen", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("the menu scrolls inside itself to its last link and the disclaimer", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();

    // A person scrolls with the wheel or a finger, never by script.
    await page.mouse.move(422, 300);
    await page.mouse.wheel(0, 2000);
    const last = menu.getByRole("link", { name: "Log in", exact: true });
    const fine = menu.getByText(
      "Concept prototype. Not an official IBM product.",
    );
    await expect(last).toBeInViewport({ ratio: 1 });
    await expect(fine).toBeInViewport({ ratio: 1 });
    await last.focus();
    await expect(last).toBeFocused();

    // Opened again, it starts at the top, where focus lands.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    const overview = menu.getByRole("link", { name: /^Overview/ });
    await expect(overview).toBeFocused();
    await expect(overview).toBeInViewport({ ratio: 1 });
  });

  test("the header's own links leave while the menu is open, the toggle stays", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await page.getByRole("button", { name: "Open menu" }).click();
    for (const name of ["Log in", "See the prototype", "Start your sprint"])
      await expect(
        header.getByRole("link", { name, exact: true }),
      ).toBeHidden();
    await expect(
      header.getByRole("button", { name: "Close menu" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      header.getByRole("link", { name: "See the prototype" }),
    ).toBeVisible();
  });
});

test("the open menu fits a tall phone without scrolling", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator(".mnav.open .mnav-foot")).toHaveCSS("opacity", "1");
  expect(
    await page.locator("#mnav").evaluate((sheet) =>
      [sheet, ...sheet.querySelectorAll("*")]
        .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY))
        .filter(
          (e) =>
            e.scrollHeight > e.clientHeight + 1 ||
            e.scrollWidth > e.clientWidth + 1,
        )
        .map((e) => e.className),
    ),
  ).toEqual([]);
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
  ).toHaveAttribute("href", "/guide");
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

test("the menu sheet and the glass bar blur what is behind them", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const blur = (selector: string) =>
    page.evaluate(
      (s) =>
        getComputedStyle(document.querySelector(s)!, "::before").backdropFilter,
      selector,
    );
  expect(await blur(".mnav")).toContain("blur(28px)");
  expect(await blur(".nav-bar")).toContain("blur(20px)");
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

test("while the menu is open, only the toggle and the sheet are reachable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  const brand = page.locator(".lp header .brand");
  expect(await brand.evaluate((el) => (el as HTMLElement).inert)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();
  expect(await brand.evaluate((el) => (el as HTMLElement).inert)).toBe(false);
});
