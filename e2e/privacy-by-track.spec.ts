import type { Page } from "@playwright/test";
import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";
import { startPrivateTrack } from "./tracks";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const column = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
const toggle = (page: Page, name: string) =>
  page.getByRole("switch", { name, exact: true });

// Seed: `seed:reset` at week 2, then Dan starts a private track through MS3.
test.describe("MS4 privacy by track", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    resetDemo("week2");
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, "dan");
    await startPrivateTrack(page);
  });
  test.afterAll(() => resetDemo());

  test("one column per track, and toggles save at once", async ({
    page,
    expectAxeClean,
  }) => {
    await nav(page).getByRole("link", { name: "Privacy by track" }).click();
    await expect(page).toHaveURL("/settings/privacy");
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy by track" }),
    ).toBeVisible();
    await expect(
      nav(page).getByRole("link", { name: "Privacy by track" }),
    ).toHaveAttribute("aria-current", "page");

    const team = column(page, "Grow in my role, Calder Lane");
    await expect(team).toContainText("Priya sees team totals only.");
    await expect(team).toContainText(
      "This is set by your workspace and can't be turned off.",
    );
    await expect(team.getByRole("switch")).toHaveCount(3);
    const career = column(page, "Change careers, private");
    await expect(career).toContainText("No employer sees anything.");
    await expect(career.getByRole("switch")).toHaveCount(3);

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectAxeClean(page);
    }

    const guide = toggle(page, "Let my guide see lesson progress");
    await expect(guide).toHaveAttribute("aria-checked", "true");
    await guide.click();
    await expect(page.getByText("Setting saved.")).toBeVisible();
    await expect(guide).toHaveAttribute("aria-checked", "false");

    const ask = toggle(page, "Ask me before anything is shared");
    const was = await ask.getAttribute("aria-checked");
    await ask.click();
    await expect(ask).not.toHaveAttribute("aria-checked", was ?? "");

    await page.reload();
    await expect(guide).toHaveAttribute("aria-checked", "false");
    await expect(ask).not.toHaveAttribute("aria-checked", was ?? "");
  });

  test("deleting the track leaves a team-only account", async ({ page }) => {
    await page.goto("/settings/privacy");
    await page.getByRole("button", { name: "Delete this track" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Delete your Change careers track?",
    });
    await expect(dialog).toContainText("Your badges and endorsements stay.");
    // Cancel keeps it.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(column(page, "Change careers, private")).toBeVisible();

    await page.getByRole("button", { name: "Delete this track" }).click();
    await dialog.getByRole("button", { name: "Delete track" }).click();
    // /home with one track is the team home.
    await expect(page).toHaveURL("/me");
    await expect(
      nav(page).getByRole("group", { name: "Your tracks" }),
    ).toHaveCount(0);
    await nav(page).getByRole("button", { name: "Dan Okafor" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Start private track" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // MS4 is for two tracks only; one track keeps its own settings.
    await page.goto("/settings/privacy");
    await expect(page).toHaveURL("/me/settings");
  });

  test("on a phone the columns stack @mobile", async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings/privacy");
    const team = await column(
      page,
      "Grow in my role, Calder Lane",
    ).boundingBox();
    const career = await column(page, "Change careers, private").boundingBox();
    expect(career!.y).toBeGreaterThan(team!.y);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectAxeClean(page);
    }
  });
});

test("a manager with the team track only keeps 17", async ({ page }) => {
  resetDemo("week2");
  await signInAs(page, "priya");
  await page.goto("/settings/privacy");
  await expect(page).toHaveURL("/settings");
});
