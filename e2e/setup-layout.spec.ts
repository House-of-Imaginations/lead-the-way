import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { TOKENS } from "./components/helpers";
import { resetDemo, signInAs } from "./demo";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const MOVED = "That page is for your team. You're back on your home.";

/** Signed up through the API, so onboarding.start never ran: an account with no workspace. */
async function signUpWithoutWorkspace(page: Page) {
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Ada Park",
      email: `e2e-layout-${Date.now()}@example.com`,
      password: "a long enough password",
    },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
}

test.describe("at setup", () => {
  test.beforeAll(() => resetDemo("setup"));

  test("Save and exit shows only on the form pages", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/setup/team");
    const exit = page
      .getByRole("banner")
      .getByRole("button", { name: "Save and exit" });
    await expect(exit).toBeVisible();
    await expect(exit).toHaveAttribute("type", "submit");
    await expect(exit).toHaveAttribute("form", "setup-form");
    await expect(exit).toHaveAttribute("name", "intent");
    await expect(exit).toHaveAttribute("value", "exit");

    await page.context().clearCookies();
    await signUpWithoutWorkspace(page);
    await page.goto("/setup/start");
    await expect(
      page.getByRole("heading", { level: 1, name: "Before you start" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save and exit" }),
    ).toHaveCount(0);
  });

  test("a manager sent to setup sees the moved toast", async ({ page }) => {
    // Priya's home at setup is /setup/team, so the toast has to live in the setup layout (Ruling 9).
    await signInAs(page, "priya");
    await page.goto("/me");
    await expect(page).toHaveURL("/setup/team");
    await expect(page.getByText(MOVED, { exact: true })).toBeVisible();
  });

  test("setup header carries the disclaimer in both themes", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await signInAs(page, "priya");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/setup/team");
      const header = page.getByRole("banner");
      await expect(header.getByText(DISCLAIMER, { exact: true })).toBeVisible();
      await expect(
        header.getByRole("link", { name: "From Zero to Hero" }),
      ).toHaveAttribute("href", "/setup/team");
      await expect(header).toHaveCSS(
        "border-bottom-color",
        TOKENS[scheme].borderSubtle,
      );
    }
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  test("setup pages pass axe in both themes", async ({
    page,
    expectAxeClean,
  }) => {
    await signInAs(page, "priya");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/setup/team");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Tell us about your team",
        }),
      ).toBeVisible();
      await expectAxeClean(page);
    }
  });
});

test.describe("at week 1", () => {
  test.beforeAll(() => resetDemo("week1"));

  test("an employee on /setup/team goes home with the moved toast", async ({
    page,
  }) => {
    await signInAs(page, "dan");
    await page.goto("/setup/team");
    await expect(page).toHaveURL("/me");
    await expect(page.getByText(MOVED, { exact: true })).toBeVisible();
  });

  test("setup pages send a launched manager to /manager", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/setup/team");
    await expect(page).toHaveURL("/manager");
  });
});

test("/setup/start keeps the narrow column", async ({ page }) => {
  await signUpWithoutWorkspace(page);
  await page.goto("/home");
  await expect(page).toHaveURL("/setup/start");
  const column = page.getByRole("main").locator(":scope > div").first();
  const box = (await column.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.width).toBeCloseTo(900, 0);
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(1);
});

test("/setup/start carries a join link's token, and Log out signs out", async ({
  page,
}) => {
  // A first social sign-in from a join link lands here with `next` (Ruling 19).
  await signUpWithoutWorkspace(page);
  await page.goto(
    `/setup/start?next=${encodeURIComponent("/join/e2e-no-such-token")}`,
  );
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/join/e2e-no-such-token");

  // Ruling 20: a way out of setup for the wrong account.
  await page.goto("/setup/start");
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Log out" })
    .click();
  await expect(page).toHaveURL("/login");
  await page.goto("/home");
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent("/home")}`);
});

test("a dotted private path shows no private content", async ({ page }) => {
  // Ruling 13: the proxy skips dotted paths, so nothing private may live at one.
  const res = await page.goto("/manager/x.y");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "We couldn't find that page.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByRole("banner")).toHaveCount(0);
});
