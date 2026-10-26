import type { Page } from "@playwright/test";
import { PARTNER, resetCareers } from "./careers";
import { E2E_DOMAIN, resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

/** The careers guide's clock (`/guide/careers`), which any session may move. */
async function moveCareersClock(
  page: Page,
  target: "week3" | "proof",
  shows: string,
) {
  await page.goto("/guide/careers");
  const controls = page.getByRole("region", { name: "Demo controls" });
  await controls.getByLabel("Move the careers demo to").selectOption(target);
  await controls.getByRole("button", { name: "Move clock" }).click();
  await expect(controls.getByText(shows)).toBeVisible();
}

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
test.afterAll(() => resetDemo());

// The careers story end to end. A new learner, Sam, goes from the partner
// page to a first lesson. The careers clock only moves Amara's seeded crew on
// (guides have no screens, so nobody else can be reviewed), so Amara moves
// the guide's careers clock and its walkthrough opens her later weeks.
test("from a partner page to proof and the next credential", async ({
  page,
}) => {
  test.setTimeout(240_000);
  resetCareers();

  // 1 Discover, then 2 Tell us: Business Analyst, where Kofi's crew has room.
  await page.goto(`/p/${PARTNER}`);
  await page.getByRole("link", { name: "Start my map" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Where are you now?" }),
  ).toBeVisible();
  await page
    .getByLabel("Where do you want to go?")
    .selectOption("Business Analyst");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Build my map" }).click();

  // 3 The map, then 3b Save your map.
  await expect(page).toHaveURL("/careers/map");
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Pivot Map" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Save my map" }).click();
  await expect(page).toHaveURL("/signup?track=career");
  await page.getByLabel("First name").fill("Sam");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`e2e-journey-${Date.now()}@${E2E_DOMAIN}`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a long enough password");
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await page.getByRole("button", { name: "Create free account" }).click();
  await expect(page).toHaveURL("/careers/journey");
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back, Sam" }),
  ).toBeVisible();

  // 4 Join a crew.
  await page.goto("/careers/crew/join");
  await expect(
    page.getByText("3 changers heading to Business Analyst."),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "I agree to this Crew Agreement." })
    .check();
  await page.getByRole("button", { name: "Join this crew" }).click();
  await expect(page.getByText("You're in.", { exact: true })).toBeVisible();

  // 4b Protect your hours: two days for the default 2 hours.
  await page.getByRole("link", { name: "Protect your hours" }).click();
  await expect(page).toHaveURL("/careers/crew/hours");
  await page.getByRole("button", { name: "Mon", exact: true }).click();
  await page.getByRole("button", { name: "Wed", exact: true }).click();
  await page.getByRole("button", { name: "Save my hours" }).click();
  await expect(
    page.getByText("Hours protected.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to this week" }).click();

  // 5 This week: the first lesson.
  await expect(page).toHaveURL("/careers/week");
  const progress = page.getByRole("progressbar");
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  await expect(
    page.getByText("Lesson complete.", { exact: true }),
  ).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");

  // 5b Crew demo day, in week 3. The guide's careers clock is for demo
  // accounts only, so the story goes on as Amara.
  await page.context().clearCookies();
  await signInAs(page, "amara");
  await moveCareersClock(page, "week3", "Tuesday 10 November at 12:00 PM");
  await page.getByRole("link", { name: /Crew demo day/ }).click();
  await expect(page).toHaveURL("/careers/crew/demo-day", { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Crew demo day" }),
  ).toBeVisible();
  // The walkthrough link's switch ends in a full load: click once hydrated.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Present to my crew" }).click();
  await expect(
    page.getByText("Presented to your crew.", { exact: true }),
  ).toBeVisible();

  // 6 Prove it, once the guide has reviewed the project.
  await moveCareersClock(page, "proof", "Monday 16 November at 12:00 PM");
  await page.getByRole("link", { name: /Prove it/ }).click();
  await expect(page).toHaveURL("/careers/proof", { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Credential earned" }),
  ).toBeVisible();
  await expect(page.getByText("Reviewed", { exact: true })).toBeVisible();

  // 7 Keep going: the next credential.
  await page.getByRole("link", { name: "Next credential" }).click();
  await expect(page).toHaveURL("/careers/journey");
  await expect(
    page.getByRole("heading", { name: "Credential 2: Data visualisation" }),
  ).toBeVisible();
});
