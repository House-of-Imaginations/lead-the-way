import type { Page } from "@playwright/test";
import { PERSONA, resetDemo, seedCareer, signInAs } from "./demo";
import { expect, test } from "./fixtures";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const card = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

// Seed: `seed:reset` at week 2, plus `seed:careerProfile` for Dan (private, no crew).
test.describe("MS2 home with two tracks", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    resetDemo("week2");
    seedCareer(PERSONA.dan);
  });
  test.afterAll(() => resetDemo());

  test("Dan sees both tracks side by side and who sees what", async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, "dan");
    await page.goto("/home");
    await expect(page).toHaveURL("/home");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /^Good (morning|afternoon|evening), Dan$/,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Two tracks this week. Each one keeps its own privacy rules.",
      ),
    ).toBeVisible();

    const team = card(page, "Grow in my role");
    await expect(team).toContainText("Week 2 of 4");
    await expect(team).toContainText("Protected hour:");
    await expect(team).toContainText(
      "Priya sees team totals only, hidden below 5 people.",
    );
    await expect(
      team.getByRole("link", { name: "Open team sprint" }),
    ).toHaveAttribute("href", "/me");

    const career = card(page, "Change careers");
    await expect(career).toContainText("Private Pivot Crews track");
    await expect(career).toContainText(
      "Calder Lane never sees this track, not even that it exists.",
    );
    await expect(
      career.getByRole("link", { name: "Open my map" }),
    ).toHaveAttribute("href", "/careers/map");

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveText([
      "Who",
      "Grow in my role",
      "Change careers",
    ]);
    await expect(
      table.getByRole("row", { name: /Priya, your manager/ }),
    ).toContainText("Nothing. Not even that this track exists");
    await expect(
      page.getByRole("link", { name: "Privacy by track" }).first(),
    ).toBeVisible();

    // The shell: the team row stays selected, and "You" holds Home.
    await expect(
      nav(page)
        .getByRole("group", { name: "Your tracks" })
        .getByRole("link", { name: /Team sprint/ }),
    ).toHaveAttribute("aria-current", "true");
    await expect(nav(page).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByText("Concept prototype. Not an official IBM product.").first(),
    ).toBeVisible();

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectAxeClean(page);
    }
  });

  test("the cards stack on a phone @mobile", async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, "dan");
    await page.goto("/home");
    const team = await card(page, "Grow in my role").boundingBox();
    const career = await card(page, "Change careers").boundingBox();
    expect(career!.y).toBeGreaterThan(team!.y + team!.height - 1);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectAxeClean(page);
    }
  });

  test("with one track, /home is that track's home", async ({ page }) => {
    resetDemo("week2");
    await signInAs(page, "dan");
    await page.goto("/home");
    await expect(page).toHaveURL("/me");
  });
});
