import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const MOVED = "That page is for your team. You're back on your home.";
const SAVED_V1 = "Version 1. Your team signs it when they join.";

const preview = (page: Page) =>
  page.getByRole("region", { name: "Live preview" });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Save agreement" });

async function open(page: Page) {
  await signInAs(page, "priya");
  await page.goto("/manager/agreement");
}

test("live preview follows the form", async ({ page }) => {
  resetDemo();
  await open(page);
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  const tool = page.getByRole("textbox", { name: "Add a tool" });
  await tool.fill("Gemini for Workspace");
  await page
    .locator("form")
    .filter({ has: tool })
    .getByRole("button", { name: "Add" })
    .click();
  await expect(preview(page)).toContainText("Gemini for Workspace");
  await expect(tool).toHaveValue("");
  await page
    .getByRole("button", { name: "Remove Gemini for Workspace" })
    .click();
  await expect(preview(page)).not.toContainText("Gemini for Workspace");

  await expect(preview(page)).toContainText("Passwords");
  await page.getByRole("checkbox", { name: "Passwords" }).uncheck();
  await expect(preview(page)).not.toContainText("Passwords");

  const own = page.getByRole("textbox", { name: "Add your own" });
  await own.fill("Draft pricing");
  await own.press("Enter");
  await expect(
    page.getByRole("checkbox", { name: "Draft pricing" }),
  ).toBeChecked();
  await expect(preview(page)).toContainText("Draft pricing");

  await page.getByRole("checkbox", { name: "Check calculations" }).check();
  await expect(
    preview(page)
      .getByRole("listitem")
      .filter({ hasText: "Check calculations" }),
  ).toHaveCount(1);

  await page
    .getByRole("textbox", { name: "When to escalate" })
    .fill("Ask before you paste anything new.");
  await expect(preview(page)).toContainText(
    "Ask before you paste anything new.",
  );
  await page
    .getByRole("combobox", { name: "AI question contact" })
    .selectOption({ label: "Privacy officer" });
  await expect(preview(page)).toContainText("Ask Privacy officer.");
  await expect(preview(page)).toContainText("Client Services team, ");
  await expect(preview(page)).toContainText(
    "Using AI here is normal. Tell us what works, what fails and what you learn.",
  );
});

test("Save agreement saves version 1 and toasts", async ({ page }) => {
  resetDemo();
  await open(page);
  await saveButton(page).click();
  await expect(
    page.getByText("Agreement saved", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(SAVED_V1, { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});

test("a second save with changes makes version 2", async ({ page }) => {
  resetDemo();
  await open(page);
  await saveButton(page).click();
  await expect(page.getByText(SAVED_V1, { exact: true })).toBeVisible();

  await saveButton(page).click();
  await expect(
    page.getByText("No changes to save", { exact: true }),
  ).toBeVisible();

  await page.getByRole("checkbox", { name: "Check calculations" }).check();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await saveButton(page).click();
  await expect(
    page.getByText("Version 2. Your team signs it when they join.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // A contact that is a person survives a round trip through a label (Contract issue 1).
  const contact = page.getByRole("combobox", { name: "AI question contact" });
  await contact.selectOption({ label: "Privacy officer" });
  await saveButton(page).click();
  await expect(
    page.getByText("Version 3. Your team signs it when they join.", {
      exact: true,
    }),
  ).toBeVisible();
  await contact.selectOption({ label: "Priya Raman" });
  await saveButton(page).click();
  await expect(
    page.getByText("Version 4. Your team signs it when they join.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(preview(page)).toContainText("Ask Priya Raman.");
});

test("Download PDF prints only the preview", async ({ page }) => {
  resetDemo();
  // Dark on screen, still light on paper.
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");

  await page.emulateMedia({ colorScheme: "dark", media: "print" });
  const sheet = page.locator('[data-print="agreement"]');
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  await expect(saveButton(page)).toBeHidden();
  await expect(page.getByRole("textbox", { name: "Add a tool" })).toBeHidden();
  await expect(
    sheet.getByText("Concept prototype. Not an official IBM product."),
  ).toBeVisible();
  await expect(sheet.locator("article")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(sheet.locator("article")).toHaveCSS("color", "rgb(22, 22, 22)");

  // One A4 page: 210 by 297 mm less 16 mm margins is 178 by 265 mm, 673 by 1001 CSS px.
  await page.setViewportSize({ width: 673, height: 1001 });
  expect((await sheet.boundingBox())!.height).toBeLessThanOrEqual(1001);
  await page.screenshot({
    path: "output/screens/06-print.png",
    fullPage: true,
  });
});

test("a tool name with markup shows as text", async ({ page }) => {
  resetDemo();
  await open(page);
  const tool = page.getByRole("textbox", { name: "Add a tool" });
  for (const name of ["<b>hi</b>", '"><img src=x>']) {
    await tool.fill(name);
    await tool.press("Enter");
  }
  await expect(preview(page)).toContainText("<b>hi</b>");
  await expect(preview(page)).toContainText('"><img src=x>');
  await expect(preview(page).locator("b")).toHaveCount(0);
  await expect(preview(page).locator("img")).toHaveCount(0);

  await saveButton(page).click();
  await expect(page.getByText(SAVED_V1, { exact: true })).toBeVisible();
  await page.reload();
  await expect(preview(page)).toContainText("<b>hi</b>");
  await expect(preview(page).locator("b")).toHaveCount(0);
  await expect(preview(page).locator("img")).toHaveCount(0);
});

test("an employee is sent home from /manager/agreement", async ({ page }) => {
  resetDemo("week1");
  await signInAs(page, "dan");
  await page.goto("/manager/agreement");
  await expect(page).toHaveURL("/me");
  await expect(page.getByText(MOVED, { exact: true })).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`06 is axe clean, ${scheme}`, async ({ page, expectAxeClean }) => {
    resetDemo();
    await page.setViewportSize({ width: 1440, height: 1160 });
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Create your Team AI Agreement",
      }),
    ).toBeVisible();
    await expectAxeClean(page);
    await page.screenshot({
      path: `output/screens/06-${scheme}.png`,
      fullPage: true,
    });
  });
}
