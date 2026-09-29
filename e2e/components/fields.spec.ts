import { expect, test } from "../fixtures";
import { THEMES, TOKENS, gallery } from "./helpers";

for (const theme of THEMES) {
  test.describe(`fields, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("a field has its label above and its helper as description @mobile", async ({
      page,
    }) => {
      const fields = page.locator("#fields");
      const email = fields.getByLabel("Work email");
      await expect(email).toHaveClass(/\bltw-field\b/);
      await expect(email).toHaveCSS("height", "40px");
      await expect(email).toHaveAccessibleDescription(
        "Use the address your team knows you by.",
      );
    });

    test("an invalid field says how to fix it", async ({ page }) => {
      const team = page.locator("#fields").getByLabel("Team name");
      await expect(team).toHaveAttribute("aria-invalid", "true");
      await expect(team).toHaveAccessibleDescription(
        "Add a team name to continue.",
      );
      await expect(team).toHaveCSS("outline-color", TOKENS[theme].supportError);
      await expect(team).toHaveCSS("outline-width", "2px");
    });

    test("the password toggle shows and hides the password @mobile", async ({
      page,
    }) => {
      const fields = page.locator("#fields");
      const password = fields.getByLabel("Password", { exact: true });
      const toggle = fields.getByRole("button", { name: "Show password" });
      await expect(password).toHaveAttribute("type", "password");
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await toggle.click();
      await expect(password).toHaveAttribute("type", "text");
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await toggle.press("Enter");
      await expect(password).toHaveAttribute("type", "password");
      await expect(toggle).toHaveCSS("width", "40px");
    });

    test("select is native and keeps its value", async ({ page }) => {
      const size = page.locator("#fields").getByLabel("Team size");
      await expect(size).toHaveValue("6 to 10");
      await size.selectOption("11 to 20");
      await expect(size).toHaveValue("11 to 20");
    });

    test("a disabled field cannot be edited", async ({ page }) => {
      await expect(
        page.locator("#fields").getByLabel("Sprint length"),
      ).toBeDisabled();
    });

    test("two safety checks gate one button", async ({ page }) => {
      const fields = page.locator("#fields");
      const save = fields.getByRole("button", { name: "Save project" });
      await expect(save).toBeDisabled();
      await fields
        .getByText("I removed client names and account numbers")
        .click();
      await expect(save).toBeDisabled();
      await fields
        .getByLabel("A person reviewed the output before it was used")
        .check();
      await expect(save).toBeEnabled();
      await expect(
        fields.getByText("Tick both safety checks to save your project."),
      ).toHaveCount(0);
    });

    test("fields pass axe", async ({ page, expectAxeClean }) => {
      await expectAxeClean(page, "#fields");
    });
  });
}
