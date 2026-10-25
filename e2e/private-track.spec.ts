import type { Page } from "@playwright/test";
import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";
import { PERSONAL_EMAIL, startPrivateTrack } from "./tracks";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const email = (page: Page) => page.getByLabel("Email for this track");
const tick = (page: Page) =>
  page.getByRole("checkbox", {
    name: "Keep this track private from my workspace.",
  });
const start = (page: Page) =>
  page.getByRole("button", { name: "Start my map" });

// Seed: `seed:reset` at week 2. Dan has the team track only until the test starts one.
test.describe("MS3 start a private track", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("Dan opens it from the account menu, and a work email is refused", async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, "dan");
    await page.goto("/me");
    await nav(page).getByRole("button", { name: "Dan Okafor" }).click();
    await page.getByRole("menuitem", { name: "Start private track" }).click();
    await expect(page).toHaveURL("/tracks/private/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "Start a private track" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Kept apart from Calder Lane" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Priya still sees team totals only, and nothing from this track.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Concept prototype. Not an official IBM product."),
    ).toBeVisible();

    // The tick gates the button, and the reason shows beside it.
    await expect(start(page)).toBeDisabled();
    await expect(
      page.getByText("Tick the box above to continue."),
    ).toBeVisible();
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectAxeClean(page);
    }

    // X3: an address on the workplace's domain is refused, and says how to fix it.
    await email(page).fill("dan.home@calderlane.com.au");
    await tick(page).check();
    await start(page).click();
    await expect(
      page.getByText(
        "Use a personal address, not one on your workplace's domain.",
      ),
    ).toBeVisible();
    await expect(email(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL("/tracks/private/new");

    // The login address is refused too.
    await email(page).fill("dan.okafor@calderlane.com.au");
    await start(page).click();
    await expect(
      page.getByText("Use a personal address, not the one you log in with."),
    ).toBeVisible();
    await expectAxeClean(page);

    // A personal address starts the track and lands on MS2.
    await email(page).fill(PERSONAL_EMAIL);
    await start(page).click();
    await expect(page).toHaveURL("/home");
    await expect(
      page.getByRole("region", { name: "Change careers", exact: true }),
    ).toContainText("Private career track");
    await expect(
      nav(page).getByRole("group", { name: "Your tracks" }),
    ).toBeVisible();

    // The account menu now offers Privacy by track instead.
    await nav(page).getByRole("button", { name: "Dan Okafor" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Privacy by track" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Start private track" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    // With two tracks, MS3 goes home.
    await page.goto("/tracks/private/new");
    await expect(page).toHaveURL("/home");
  });

  test("it fits a phone @mobile", async ({ page, expectAxeClean }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, "dan");
    await page.goto("/tracks/private/new");
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/home",
    );
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(390);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectAxeClean(page);
    }
  });

  // X2 in the browser: a private track changes nothing Priya can see.
  test("Priya's overview is the same before and after Dan starts a private track", async ({
    browser,
  }) => {
    const viewport = { width: 1440, height: 900 };
    const priyaContext = await browser.newContext({ viewport });
    const danContext = await browser.newContext({ viewport });
    try {
      const priya = await priyaContext.newPage();
      await signInAs(priya, "priya");
      const overview = async () => {
        await priya.goto("/manager");
        await expect(
          priya.getByRole("list", { name: "Team progress", exact: true }),
        ).toBeVisible();
        return {
          main: await priya.getByRole("main").innerText(),
          nav: await nav(priya).innerText(),
        };
      };
      const before = await overview();

      const dan = await danContext.newPage();
      await signInAs(dan, "dan");
      await startPrivateTrack(dan);

      expect(await overview()).toEqual(before);
    } finally {
      await priyaContext.close();
      await danContext.close();
    }
  });
});
