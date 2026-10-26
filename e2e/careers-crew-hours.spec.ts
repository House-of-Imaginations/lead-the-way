import { LOOKS, look, resetCareers } from "./careers";
import { signInAs } from "./demo";
import { expect, test } from "./fixtures";

// 4b Protect your hours (`/careers/crew/hours`), as Amara: Thursdays and Sundays at 8 PM (seed).
test.describe("protect your hours", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetCareers());

  for (const { width, colorScheme } of LOOKS) {
    test(`protect your hours at ${width}, ${colorScheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await look(page, width, colorScheme);
      await signInAs(page, "amara");
      await page.goto("/careers/crew/hours");
      await expect(
        page.getByRole("heading", { level: 1, name: "Protect your hours" }),
      ).toBeVisible();
      await expect(
        page.getByText("You chose 2 hours a week.", { exact: false }),
      ).toBeVisible();
      for (const day of ["Thu", "Sun"])
        await expect(
          page.getByRole("button", { name: day, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("2 of 2 picked")).toBeVisible();
      await expect(page.getByLabel("Start time")).toHaveValue("20:00");
      await expect(
        page.getByRole("heading", { name: "Your first 4 weeks" }),
      ).toBeVisible();
      // Tuesdays are the crew's, Thursdays and Sundays are Amara's.
      const week1 = page.getByRole("row", { name: /^Week 1/ });
      await expect(week1.getByRole("cell")).toHaveText([
        "26",
        "27, Crew",
        "28",
        "29, 8 PM",
        "30",
        "31",
        "1, 8 PM",
      ]);
      await expect(
        page.getByRole("checkbox", { name: "Add a weekly calendar hold" }),
      ).toBeChecked();
      await expect(
        page.getByText("Busy week? Move a block any time. Nobody is told."),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Save my hours" }),
      ).toBeEnabled();
      if (width === 390)
        await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
          "href",
          "/careers/crew/join",
        );
      await expectAxeClean(page);
    });
  }

  test("the crew's cells use a fill that stays dark in dark mode", async ({
    page,
  }) => {
    await look(page, 1440, "dark");
    await signInAs(page, "amara");
    await page.goto("/careers/crew/hours");
    const crew = page
      .getByRole("row", { name: /^Week 1/ })
      .getByRole("cell")
      .nth(1);
    await expect(crew).toHaveText("27, Crew");
    // button-secondary in dark (#6f6f6f), never border-inverse's #f4f4f4.
    await expect(crew).toHaveCSS("background-color", "rgb(111, 111, 111)");
    await expect(crew).toHaveCSS("color", "rgb(255, 255, 255)");
  });

  test("a third day swaps out the oldest", async ({ page }) => {
    await look(page, 390, "light");
    await signInAs(page, "amara");
    await page.goto("/careers/crew/hours");
    await page.getByRole("button", { name: "Mon", exact: true }).click();
    // Thursday came first, so it goes.
    for (const [day, on] of [
      ["Mon", "true"],
      ["Thu", "false"],
      ["Sun", "true"],
    ])
      await expect(
        page.getByRole("button", { name: day, exact: true }),
      ).toHaveAttribute("aria-pressed", on);
    await expect(page.getByText("2 of 2 picked")).toBeVisible();
  });
});
