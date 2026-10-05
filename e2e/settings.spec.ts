import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { PERSONA, resetDemo, signInAs } from "./demo";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

// Never change Priya's or Dan's name or zone here: other specs read them.
test.describe("settings", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("Priya opens 17 from the account menu, on Profile", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await nav(page).getByRole("button", { name: "Priya Raman" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Your personal account settings. Team and sprint settings live in Workspace settings.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Profile", selected: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Priya Raman");
    const email = page.getByLabel("Work email");
    await expect(email).toHaveValue(PERSONA.priya);
    await expect(email).toHaveAttribute("readonly", "");
    await expect(
      page.getByText("Your sign-in address. It can't be changed here."),
    ).toBeVisible();
    await expect(page.getByLabel("Time zone")).toHaveValue(
      "Australia/Melbourne",
    );
    await expect(page.getByLabel("Theme")).toHaveValue("system");
    await expect(page.getByLabel("Turn captions on by default")).toBeChecked();
    await expect(page.getByLabel("Reduce motion")).not.toBeChecked();
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  });

  test("Save changes keeps the job title, theme and reduce motion across a reload", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.goto("/settings");
    const html = page.locator("html");
    await page.getByLabel("Job title").fill("Head of Client Services");
    await page.getByLabel("Theme").selectOption("dark");
    await page.getByLabel("Reduce motion").check();
    // Applied on Save, not on select (Ruling 7).
    await expect(html).not.toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Changes saved.", { exact: true }),
    ).toBeVisible();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveAttribute("data-reduce-motion", "");
    await page.reload();
    await expect(page.getByLabel("Job title")).toHaveValue(
      "Head of Client Services",
    );
    await expect(page.getByLabel("Theme")).toHaveValue("dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveAttribute("data-reduce-motion", "");
    // The side nav reads the new job title.
    await expect(nav(page).getByText("Head of Client Services")).toBeVisible();
  });

  test("a blank name says how to fix it, and Cancel goes home", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.goto("/settings");
    const name = page.getByLabel("Full name");
    await name.fill("   ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("A name is required.", { exact: true }),
    ).toBeVisible();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL("/manager");
  });

  test("each area has its own settings page", async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto("/settings");
    await expect(page).toHaveURL("/me/settings");
    await expect(
      page.getByText(
        "Your account, reminders and what you share. Workspace settings are managed by Priya Raman.",
      ),
    ).toBeVisible();
    await signInAs(page, "priya");
    await page.goto("/me/settings");
    await expect(page).toHaveURL(/\/manager(\?|$)/);
  });
});
