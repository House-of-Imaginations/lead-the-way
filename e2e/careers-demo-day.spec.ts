import { LOOKS, look, resetCareers } from "./careers";
import { signInAs } from "./demo";
import { expect, test } from "./fixtures";

// 5b Crew demo day (`/careers/crew/demo-day`), as Amara at week 3: the project written up (seed).
test.describe("crew demo day", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetCareers("week3"));
  test.afterAll(() => resetCareers());

  for (const { width, colorScheme } of LOOKS) {
    test(`crew demo day at ${width}, ${colorScheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await look(page, width, colorScheme);
      await signInAs(page, "amara");
      await page.goto("/careers/crew/demo-day");
      await expect(
        page.getByRole("heading", { level: 1, name: "Crew demo day" }),
      ).toBeVisible();
      await expect(page.getByText(/^Credential 1 of 3, week 3$/)).toBeVisible();
      await expect(page.getByText("Tuesday 10 November, 7 PM")).toBeVisible();
      await expect(page.getByText("Video call, 5 minutes each")).toBeVisible();
      await expect(
        page
          .getByText("Tidy four store sales exports and show weekly trends.", {
            exact: true,
          })
          .first(),
      ).toBeVisible();
      await expect(page.getByLabel("What I learned")).not.toHaveValue("");
      await expect(
        page.getByRole("switch", { name: "Add this reflection to my proof" }),
      ).toBeVisible();
      const session = page.getByRole("region", { name: "In this session" });
      await expect(session.getByRole("listitem")).toHaveCount(5);
      await expect(session.getByText("You", { exact: true })).toBeVisible();
      await expect(
        page.getByText(
          "Everyone chose to share. Nothing is shared automatically.",
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Talk about as a crew" }),
      ).toBeVisible();
      await expectAxeClean(page);
    });
  }

  test("presenting swaps to the credential", async ({ page }) => {
    await look(page, 390, "light");
    await signInAs(page, "amara");
    await page.goto("/careers/crew/demo-day");
    await page.getByRole("button", { name: "Present to my crew" }).click();
    await expect(
      page.getByText("Presented to your crew.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "See your credential" }),
    ).toHaveAttribute("href", "/careers/proof");
  });
});
