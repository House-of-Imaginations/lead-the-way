import { LOOKS, look, resetCareers } from "./careers";
import { signInAs } from "./demo";
import { expect, test } from "./fixtures";

// 5 and D5 This week (`/careers/week`), as Amara at week 2: lesson 4 done (seed).
test.describe("this week", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetCareers("week2"));
  test.afterAll(() => resetCareers());

  for (const { width, colorScheme } of LOOKS) {
    test(`this week at ${width}, ${colorScheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await look(page, width, colorScheme);
      await signInAs(page, "amara");
      await page.goto("/careers/week");
      await expect(page.getByText("Credential 1 of 3, week 2")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 1, name: /^This week/ }),
      ).toBeVisible();
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "4",
      );
      await expect(page.locator("li[aria-current=step]")).toHaveCount(1);
      await expect(
        page.getByRole("switch", { name: "Low energy? Listen instead" }),
      ).toBeVisible();
      await expect(
        page.getByText("Share one thing you tried this week."),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Mark lesson complete" }),
      ).toBeVisible();
      if (width === 1440) {
        await expect(page.getByText("Tuesday 3 November, 7 PM")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Add to calendar" }),
        ).toBeVisible();
        await expect(
          page.getByText("Your employer never sees your map or your progress."),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Coming up in week 3" }),
        ).toBeVisible();
        const nav = page.getByRole("navigation", { name: "Main" });
        await expect(
          nav.getByRole("link", { name: "This week" }),
        ).toHaveAttribute("aria-current", "page");
      } else {
        await expect(
          page.getByRole("heading", {
            name: "Crew check-in, Tue 3 Nov, 7 PM",
          }),
        ).toBeVisible();
        await expect(page.getByText("Lena and 4 others")).toBeVisible();
      }
      await expectAxeClean(page);
    });
  }

  test("marking a lesson complete moves the progress on", async ({ page }) => {
    await look(page, 390, "light");
    await signInAs(page, "amara");
    await page.goto("/careers/week");
    await page.getByRole("button", { name: "Mark lesson complete" }).click();
    await expect(
      page.getByText("Lesson complete.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "5",
    );
  });
});
