import { LOOKS, look, resetCareers, signUpCareer } from "./careers";
import { signInAs } from "./demo";
import { expect, test } from "./fixtures";

// 4 Join a crew (`/careers/crew/join`), as Amara: joined and agreed (seed).
test.describe("join a crew", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetCareers());

  for (const { width, colorScheme } of LOOKS) {
    test(`join a crew at ${width}, ${colorScheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await look(page, width, colorScheme);
      await signInAs(page, "amara");
      await page.goto("/careers/crew/join");
      await expect(
        page.getByRole("heading", { level: 1, name: "Meet your crew" }),
      ).toBeVisible();
      await expect(page.getByText("Pathway Guide")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "Lena" }),
      ).toBeVisible();
      await expect(
        page.getByText("5 changers heading to Data Analyst."),
      ).toBeVisible();
      await expect(
        page.getByText("Check-ins Tuesdays, 7 to 8 PM, from 27 October."),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Crew Agreement" }),
      ).toBeVisible();
      await expect(
        page.getByRole("checkbox", { name: "I agree to this Crew Agreement." }),
      ).toBeChecked();
      await expect(
        page.getByRole("link", { name: "Protect your hours" }),
      ).toHaveAttribute("href", "/careers/crew/hours");
      // The nav's own at 1440, the shell's on a phone.
      await expect(
        page
          .getByText("Concept prototype. Not an official IBM product.")
          .filter({ visible: true }),
      ).toHaveCount(1);
      if (width === 1440) {
        const nav = page.getByRole("navigation", { name: "Main" });
        await expect(
          nav.getByRole("link", { name: "My crew" }),
        ).toHaveAttribute("aria-current", "page");
        await expect(nav.getByText("Next crew check-in")).toBeVisible();
        await expect(nav.getByText("Tue 27 Oct, 7 PM")).toBeVisible();
      } else {
        await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
          "href",
          "/careers/map",
        );
      }
      await expectAxeClean(page);
    });
  }

  // 4, then 4b, then 5: a new learner joins, protects their hours and opens the week.
  test("a new learner joins a crew, protects their hours and opens this week", async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, 1440, "light");
    await signUpCareer(page);
    await page.goto("/careers/week");
    await expect(page).toHaveURL("/careers/crew/join");
    await expect(
      page.getByText("3 changers heading to Business Analyst."),
    ).toBeVisible();
    const join = page.getByRole("button", { name: "Join this crew" });
    await expect(join).toBeDisabled();

    // A rule written before joining is kept, and an unticked one stays off.
    await page.getByLabel("Add your own rule").fill("Cameras on for demos");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Proposed by you")).toBeVisible();
    await expectAxeClean(page);
    await page
      .getByRole("checkbox", { name: "I agree to this Crew Agreement." })
      .check();
    await join.click();
    await expect(page.getByText("You're in.", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Cameras on for demos" }),
    ).toBeChecked();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByText("Thu 29 Oct, 7 PM")).toBeVisible();

    await page.getByRole("link", { name: "Protect your hours" }).click();
    await expect(page).toHaveURL("/careers/crew/hours");
    const save = page.getByRole("button", { name: "Save my hours" });
    await expect(save).toBeDisabled();
    await page.getByRole("button", { name: "Mon", exact: true }).click();
    await page.getByRole("button", { name: "Wed", exact: true }).click();
    await expect(page.getByText("2 of 2 picked")).toBeVisible();
    await page.getByLabel("Start time").selectOption("07:00");
    await save.click();
    await expect(
      page.getByText("Hours protected.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Mondays and Wednesdays at 7 AM.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Go to this week" }).click();

    await expect(page).toHaveURL("/careers/week");
    await expect(
      page.getByRole("heading", { level: 1, name: /^This week/ }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });
});
