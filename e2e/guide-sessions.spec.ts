import type { Page } from "@playwright/test";
import { look, LOOKS } from "./careers";
import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";
import { startPrivateTrack } from "./tracks";

// P14b: a researcher runs four sessions from /guide with no terminal,
// resetting between them with the guide's own Reset demo (spec 1, Success).
test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetDemo());
test.afterAll(() => resetDemo());

const session = (page: Page, title: string) =>
  page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });

/** The guide's Reset demo, confirmed in its modal. */
async function resetFromGuide(page: Page) {
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("M0 shows the master journey, the tracks and the sessions", async ({
  page,
}) => {
  await signInAs(page, "priya");
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Learn what's next, with people who back you.",
    }),
  ).toBeVisible();
  for (const name of [
    "The master journey",
    "Two tracks",
    "Privacy, split by track",
    "One core, two ways in",
    "Research sessions",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open team guide" }),
  ).toHaveAttribute("href", "/guide/team");
  await expect(
    page.getByRole("link", { name: "Open careers guide" }),
  ).toHaveAttribute("href", "/guide/careers");
  await expect(
    page.getByText("Concept prototype. Not an official IBM product.").first(),
  ).toBeVisible();
});

test("session 1: the team story starts as Priya on the team guide", async ({
  page,
}) => {
  await signInAs(page, "dan"); // anyone in the demo can start it
  await page.goto("/guide");
  await session(page, "The team story")
    .getByRole("button", { name: "Start as Priya" })
    .click();
  await expect(page).toHaveURL("/guide/team", { timeout: 20_000 });
  await expect(page.getByText("You're signed in as Priya")).toBeVisible();
  await page.getByRole("link", { name: /Start the walkthrough/ }).click();
  await expect(page).toHaveURL("/demo/partner-email");
});

test("session 2: Amara's careers story, the careers clock and its counts", async ({
  page,
}) => {
  await signInAs(page, "priya");
  await page.goto("/guide");
  await session(page, "Amara's careers story")
    .getByRole("button", { name: "Start as Amara" })
    .click();
  await expect(page).toHaveURL("/guide/careers", { timeout: 20_000 });
  const controls = page.getByRole("region", { name: "Demo controls" });
  await expect(
    controls.getByText("Monday 26 October at 9:00 AM"),
  ).toBeVisible();
  await expect(controls.getByText("Pivot Maps built")).toBeVisible();

  // From Discover to Keep going: the first and last steps open their screens.
  await page.getByRole("link", { name: /Discover/ }).click();
  await expect(page).toHaveURL("/p/footscray-library");
  await page.goto("/guide/careers");

  await controls.getByLabel("Move the careers demo to").selectOption("week3");
  await controls.getByRole("button", { name: "Move clock" }).click();
  await expect(
    controls.getByText("Tuesday 10 November at 12:00 PM"),
  ).toBeVisible();
  await controls.getByRole("button", { name: "Miss a week" }).click();
  await expect(controls.getByText("Amara has missed a week")).toBeVisible();
  await expect(
    controls.getByRole("button", { name: "Miss a week" }),
  ).toBeDisabled();

  await page.getByRole("link", { name: /Keep going/ }).click();
  await expect(page).toHaveURL("/careers/journey");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Amara holds no Calder Lane seat; the careers guide's reset still works.
  await page.goto("/guide/careers");
  await resetFromGuide(page);
  await expect(
    controls.getByText("Monday 26 October at 9:00 AM"),
  ).toBeVisible();
  await expect(
    controls.getByRole("button", { name: "Miss a week" }),
  ).toBeEnabled();
});

test("session 3: Dan starts a private track and sees two-track Home", async ({
  page,
}) => {
  await signInAs(page, "amara");
  await page.goto("/guide");
  await session(page, "Dan starts a private track")
    .getByRole("button", { name: "Start as Dan" })
    .click();
  // Seated at week 1, team-only: his home is the team sprint.
  await expect(page).toHaveURL("/me", { timeout: 20_000 });
  const item = page.getByRole("menuitem", { name: "Start private track" });
  // A click before hydration opens nothing; try again until the menu shows.
  await expect(async () => {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Dan Okafor" })
      .click();
    await expect(item).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await item.click();
  await startPrivateTrack(page);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^Good (morning|afternoon|evening), Dan$/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Grow in my role", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Change careers", exact: true }),
  ).toBeVisible();

  // Reset as Dan: his private track goes, and he is team-only again.
  await page.goto("/guide");
  await resetFromGuide(page);
  await session(page, "Dan starts a private track")
    .getByRole("button", { name: "Skip the form" })
    .click();
  await expect(page).toHaveURL("/home", { timeout: 20_000 });
  await expect(
    page.getByRole("region", { name: "Change careers", exact: true }),
  ).toBeVisible();
});

test("session 4: privacy by track opens as Dan with a private track", async ({
  page,
}) => {
  await signInAs(page, "priya");
  await page.goto("/guide");
  await resetFromGuide(page);
  await session(page, "Privacy by track")
    .getByRole("button", { name: "Start as Dan" })
    .click();
  await expect(page).toHaveURL("/settings/privacy", { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacy by track" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Change careers, private", exact: true }),
  ).toContainText("No employer sees anything.");
});

test("B1 shows the blueprint and the line of visibility", async ({ page }) => {
  await signInAs(page, "priya");
  await page.goto("/guide/careers");
  await page.getByRole("link", { name: "Open blueprint" }).click();
  await expect(page).toHaveURL("/guide/blueprint");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Experience map and service blueprint",
    }),
  ).toBeVisible();
  const map = page.getByRole("region", { name: "Service blueprint" });
  for (const text of [
    "Awareness",
    "After-sales",
    "Relieved, confident",
    "Completes and continues",
  ])
    await expect(map.getByText(text, { exact: true })).toBeVisible();
  await expect(map.getByText(/^Line of visibility\./)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Value proposition (NABC)" }),
  ).toBeVisible();
});

for (const path of ["/guide", "/guide/careers", "/guide/blueprint"]) {
  for (const { width, colorScheme } of LOOKS) {
    test(`${path} passes axe, ${colorScheme} at ${width}`, async ({
      page,
      expectAxeClean,
    }) => {
      await look(page, width, colorScheme);
      await signInAs(page, "priya");
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (path !== "/guide/blueprint")
        await expect(
          page.getByRole("button", { name: "Reset demo" }),
        ).toBeVisible();
      await expectAxeClean(page);
      const spill = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(spill).toBe(false);
    });
  }
}
