import type { Page } from "@playwright/test";
import { E2E_DOMAIN, PERSONA, resetDemo, seedCareer, signInAs } from "./demo";
import { expect, test } from "./fixtures";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const tracks = (page: Page) =>
  nav(page).getByRole("group", { name: "Your tracks" });

test.describe("two tracks", () => {
  test.describe.configure({ mode: "serial" });
  test.afterAll(() => resetDemo());

  // Review Focus 3: /home for two tracks lands on the team home, never loops.
  test("Dan with a private track sees the switcher, and /home opens his team home", async ({
    page,
    expectAxeClean,
  }) => {
    resetDemo("week2");
    seedCareer(PERSONA.dan);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, "dan");
    await page.goto("/home");
    await expect(page).toHaveURL("/me");

    const team = tracks(page).getByRole("link", { name: /Team sprint/ });
    await expect(team).toContainText("Calder Lane, week 2 of 4");
    await expect(team).toHaveAttribute("aria-current", "true");
    const career = tracks(page).getByRole("link", { name: /Change careers/ });
    await expect(career).toContainText("Private");
    await expect(career).toHaveAttribute("href", "/careers/journey");
    await expect(career).not.toHaveAttribute("aria-current", /.*/);
    await expect(
      nav(page).getByRole("button", { name: "Dan Okafor" }),
    ).toContainText("Two tracks");
    await expect(
      nav(page).getByRole("button", { name: "Calder Lane" }),
    ).toHaveCount(0);

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectAxeClean(page);
    }
  });

  test("Dan without a career track keeps today's shell (D2)", async ({
    page,
  }) => {
    resetDemo("week2");
    await signInAs(page, "dan");
    await page.goto("/me");
    await expect(nav(page)).toBeVisible();
    await expect(tracks(page)).toHaveCount(0);
    await expect(nav(page).getByText("Calder Lane").first()).toBeVisible();
    await expect(nav(page).locator(".ltw-sn-org")).toBeVisible();
  });

  test("a two-track owner finds the workspace items in the account menu (R4)", async ({
    page,
  }) => {
    const email = `e2e-two-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
    const res = await page.request.post("/api/auth/sign-up/email", {
      data: { name: "Kai Moreno", email, password: "a long enough password" },
      headers: { origin: "http://localhost:3000" },
    });
    expect(res.ok()).toBe(true);
    await page.goto("/setup/start");
    await page
      .getByRole("checkbox", {
        name: "I agree to the terms of use and privacy notice.",
      })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL("/setup/team");
    seedCareer(email);

    await page.goto("/workspace/settings");
    await expect(tracks(page)).toBeVisible();
    await nav(page).getByRole("button", { name: "Kai Moreno" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Create workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Workspace settings" }),
    ).toHaveCount(1);
  });
});
