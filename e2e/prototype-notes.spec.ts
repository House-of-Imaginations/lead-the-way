import type { Page } from "@playwright/test";
import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

test.describe.configure({ mode: "serial" });
test.afterAll(() => resetDemo());

const panel = (page: Page) =>
  page.getByRole("complementary", { name: "Prototype notes" });

test("notes are off by default and turn on from the guide", async ({
  page,
}) => {
  resetDemo();
  await signInAs(page, "priya");
  await page.goto("/setup/team");
  await expect(panel(page)).toHaveCount(0);
  await page.goto("/guide/team");
  await page.getByRole("switch", { name: "Prototype notes" }).click();
  await page.goto("/setup/team");
  await expect(
    panel(page).getByRole("heading", { name: "03 Setup 1: your team" }),
  ).toBeVisible();
  await expect(panel(page).getByText("Why", { exact: true })).toBeVisible();
});

test("the account menu turns notes off, and the choice is remembered", async ({
  page,
}) => {
  resetDemo("week1");
  await signInAs(page, "priya");
  await page.goto("/guide/team");
  await page.getByRole("switch", { name: "Prototype notes" }).click();
  await page.goto("/manager");
  await expect(panel(page)).toBeVisible();
  // As e2e/shell.spec.ts opens it: the account button in the side nav.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: "Priya Raman" })
    .click();
  await page.getByRole("menuitem", { name: "Hide prototype notes" }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.reload();
  await expect(panel(page)).toHaveCount(0);
});

test("the landing never shows notes", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("ltw-prototype-notes", "on"),
  );
  await page.goto("/");
  await expect(panel(page)).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`the open panel passes axe at ${width}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() =>
      localStorage.setItem("ltw-prototype-notes", "on"),
    );
    await page.goto("/demo/partner-email");
    await expect(panel(page)).toBeVisible();
    await expectAxeClean(page);
  });
}
