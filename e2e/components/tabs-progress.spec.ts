import { expect, test } from "../fixtures";
import { THEMES, expectedRing, focusRing, gallery } from "./helpers";

for (const theme of THEMES) {
  test.describe(`tabs and progress, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("tabs follow the arrow keys", async ({ page }) => {
      const section = page.locator("#tabs-progress");
      const list = section.getByRole("tablist", { name: "Settings sections" });
      const profile = list.getByRole("tab", { name: "Profile" });
      await expect(profile).toHaveAttribute("aria-selected", "true");
      await expect(profile).toHaveCSS("font-weight", "600");
      expect(await focusRing(profile)).toEqual(expectedRing(theme));
      await page.keyboard.press("ArrowRight");
      const notifications = list.getByRole("tab", { name: "Notifications" });
      await expect(notifications).toBeFocused();
      await expect(notifications).toHaveAttribute("aria-selected", "true");
      await expect(
        section.getByRole("tabpanel", { name: "Notifications" }),
      ).toHaveText("Reminders before the protected hour.");
    });

    test("the disclosure opens and closes from the keyboard", async ({
      page,
    }) => {
      const details = page.locator("#tabs-progress details", {
        hasText: "Why can't I see individual progress?",
      });
      const summary = details.locator("summary");
      await expect(summary).toHaveText("Why can't I see individual progress?");
      await expect(details).not.toHaveAttribute("open", "");
      expect(await focusRing(summary)).toEqual(expectedRing(theme));
      await page.keyboard.press("Enter");
      await expect(details).toHaveAttribute("open", "");
      await expect(
        details.getByText(/From hero to zero shows you team totals only/),
      ).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(details).not.toHaveAttribute("open", "");
    });

    test("a progress bar reports a count, not a percentage of a person", async ({
      page,
    }) => {
      const bar = page
        .locator("#tabs-progress")
        .getByRole("progressbar", { name: "Joined the sprint" });
      await expect(bar).toHaveAttribute("aria-valuenow", "5");
      await expect(bar).toHaveAttribute("aria-valuemax", "8");
      await expect(bar).toHaveAttribute("aria-valuetext", "5 of 8 teammates");
      await expect(bar).toHaveCSS("height", "4px");
      await expect(bar.locator(".ltw-pb-fill")).toHaveCSS(
        "transform",
        "matrix(0.625, 0, 0, 1, 0, 0)",
      );
    });

    test("progress steps mark done, current and to do", async ({ page }) => {
      const steps = page
        .locator("#tabs-progress")
        .getByRole("list", { name: "Setup progress" });
      await expect(steps.getByRole("listitem")).toHaveCount(4);
      await expect(steps.locator(".ltw-step-done")).toHaveCount(1);
      await expect(steps.locator('[aria-current="step"]')).toContainText(
        "Protected hour",
      );
      await expect(steps.locator(".ltw-step-done")).toContainText("Done:");
    });

    test("tabs and progress pass axe", async ({ page, expectAxeClean }) => {
      await expectAxeClean(page, "#tabs-progress");
    });
  });
}
