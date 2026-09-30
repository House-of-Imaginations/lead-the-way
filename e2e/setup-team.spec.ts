import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const STALE =
  "You switched workspace in another tab. Reload the page to continue.";
const LIKERT =
  "How confident do you feel setting AI norms for your team today? (1 is not at all, 5 is very)";
const AI_USE = [
  ["Not using AI", "Little or no use yet"],
  ["Exploring occasionally", "A few people try it now and then"],
  ["Using AI regularly", "Part of some weekly tasks"],
  [
    "Advanced users, inconsistent practices",
    "Heavy use, but everyone does it differently",
  ],
] as const;
const CHALLENGES = [
  "Unsure what AI tools are safe",
  "Staff are using AI differently",
  "Lack of time to learn",
  "Difficult to turn learning into work",
  "Staff are reluctant to discuss AI use",
  "Hard to demonstrate capability",
  "Other",
];

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const size = (page: Page) => page.getByRole("group", { name: "Team size" });
const aiUse = (page: Page) =>
  page.getByRole("group", { name: "How does your team use AI today?" });
const next = (page: Page) => page.getByRole("button", { name: "Continue" });
const challenge = (page: Page, name: string) =>
  page.getByRole("checkbox", { name, exact: true });
const more = (page: Page) =>
  page.getByRole("textbox", { name: "Tell us more" });

/** Page 1 as 03's PNG shows it. */
async function fillPage1(page: Page) {
  await size(page).getByRole("button", { name: "6 to 10" }).click();
  await page
    .getByRole("combobox", { name: "Industry" })
    .selectOption("Professional services");
  await page
    .getByRole("combobox", { name: "Main team function" })
    .selectOption("Client service");
  await aiUse(page)
    .getByRole("radio", { name: "Advanced users, inconsistent practices" })
    .check();
}

test.beforeEach(async ({ page }) => {
  resetDemo("setup");
  await signInAs(page, "priya");
});

test("page 1 matches the wireframe copy", async ({ page }) => {
  await page.goto("/setup/team");
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Tell us about your team",
  });
  await expect(heading).toBeVisible();
  await expect(
    page.getByText(
      "A few details so the sprint fits the work your team already does.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(size(page).getByRole("button")).toHaveText([
    "2 to 5",
    "6 to 10",
    "11 to 20",
    "21 or more",
  ]);
  await expect(
    page.getByRole("combobox", { name: "Industry" }).locator("option"),
  ).toHaveText([
    "Choose an industry",
    "Professional services",
    "Marketing",
    "Finance",
    "Technology",
    "Education",
    "Not-for-profit",
    "Other",
  ]);
  await expect(
    page
      .getByRole("combobox", { name: "Main team function" })
      .locator("option"),
  ).toHaveText([
    "Choose a team function",
    "Marketing",
    "Operations",
    "Client service",
    "HR",
    "Finance",
    "Product",
    "General administration",
  ]);
  for (const [title, description] of AI_USE) {
    await expect(aiUse(page).getByRole("radio", { name: title })).toHaveCount(
      1,
    );
    await expect(aiUse(page).getByText(description)).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
  await expect(next(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save and exit" }),
  ).toBeVisible();
  // Ruling 11: the two columns stack below 900px.
  await page.setViewportSize({ width: 899, height: 900 });
  const h = (await heading.boundingBox())!;
  const g = (await size(page).boundingBox())!;
  expect(g.y).toBeGreaterThan(h.y + h.height);
});

test("Continue saves page 1 and opens page 2", async ({ page }) => {
  await page.goto("/setup/team");
  await fillPage1(page);
  await next(page).click();
  await expect(page).toHaveURL("/setup/team?page=2");
  await expect(
    page.getByRole("heading", { level: 1, name: "What gets in the way?" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We'll tailor the four-week sprint around your team's needs.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  const list = page.getByRole("group", {
    name: "Main challenges (select all that apply)",
  });
  await expect(list.getByRole("checkbox")).toHaveCount(CHALLENGES.length);
  for (const name of CHALLENGES) {
    await expect(challenge(page, name)).toBeVisible();
  }
  await expect(page.getByRole("group", { name: LIKERT })).toBeVisible();

  // Saved, not just remembered: a fresh load of page 1 reads it back.
  await page.goto("/setup/team");
  await expect(
    size(page).getByRole("button", { name: "6 to 10" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "Industry" })).toHaveValue(
    "Professional services",
  );
  await expect(
    page.getByRole("combobox", { name: "Main team function" }),
  ).toHaveValue("Client service");
  await expect(
    aiUse(page).getByRole("radio", {
      name: "Advanced users, inconsistent practices",
    }),
  ).toBeChecked();
});

test("Other shows Tell us more", async ({ page }) => {
  await page.goto("/setup/team?page=2");
  await expect(more(page)).toHaveCount(0);
  await challenge(page, "Other").check();
  await expect(more(page)).toBeVisible();
  await expect(more(page)).toHaveAttribute(
    "placeholder",
    "For example, leadership wants a policy before anyone experiments",
  );
  await challenge(page, "Other").uncheck();
  await expect(more(page)).toHaveCount(0);
});

test("Continue on page 2 saves the team and goes to the protected hour", async ({
  page,
}) => {
  await page.goto("/setup/team?page=2");
  await challenge(page, "Staff are using AI differently").check();
  await challenge(page, "Other").check();
  await more(page).fill("Leadership wants a policy first");
  await page.getByRole("radio", { name: "2", exact: true }).check();
  await next(page).click();
  // 04 is Task 10's. Before it lands this URL is a 404; the URL is what counts here.
  await expect(page).toHaveURL("/setup/protected-hour");

  await page.goto("/setup/team?page=2");
  await expect(challenge(page, "Staff are using AI differently")).toBeChecked();
  await expect(more(page)).toHaveValue("Leadership wants a policy first");
  await expect(
    page.getByRole("radio", { name: "2", exact: true }),
  ).toBeChecked();
});

test("the checklist marks Your team done", async ({ page }) => {
  await page.goto("/manager");
  await expect(
    nav(page).getByRole("link", { name: "Your team", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await page.goto("/setup/team");
  await next(page).click();
  await expect(page).toHaveURL("/setup/team?page=2");
  await next(page).click();
  await expect(page).toHaveURL("/setup/protected-hour");
  await page.goto("/manager");
  await expect(
    nav(page).getByRole("link", { name: "Done: Your team" }),
  ).toBeVisible();
});

test("Save and exit saves a draft and goes to /manager", async ({ page }) => {
  await page.goto("/setup/team");
  await size(page).getByRole("button", { name: "11 to 20" }).click();
  await page.getByRole("button", { name: "Save and exit" }).click();
  await expect(page).toHaveURL("/manager");
  // A draft: the step is still the current one, not done.
  const yourTeam = nav(page).getByRole("link", {
    name: "Your team",
    exact: true,
  });
  await expect(yourTeam).toHaveAttribute("aria-current", "step");
  await page.goto("/setup/team");
  await expect(
    size(page).getByRole("button", { name: "11 to 20" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Page 2 exits the same way and keeps page 1's answers.
  await page.goto("/setup/team?page=2");
  await challenge(page, "Lack of time to learn").check();
  await page.getByRole("button", { name: "Save and exit" }).click();
  await expect(page).toHaveURL("/manager");
  await expect(yourTeam).toHaveAttribute("aria-current", "step");
  await page.goto("/setup/team?page=2");
  await expect(challenge(page, "Lack of time to learn")).toBeChecked();
  await page.goto("/setup/team");
  await expect(
    size(page).getByRole("button", { name: "11 to 20" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Back goes to / on page 1 and to page 1 on page 2", async ({ page }) => {
  await page.goto("/setup/team?page=2");
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/setup/team");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL("/");
});

test("a stale workspace refuses the save", async ({ page }) => {
  await page.goto("/setup/team");
  await expect(
    page.getByRole("heading", { level: 1, name: "Tell us about your team" }),
  ).toBeVisible();
  // A reset writes Calder Lane again under a new id and opens it for Priya,
  // just as a switch in another tab would: the page's expectOrgId is stale.
  resetDemo("setup");
  await next(page).click();
  // exact: the dev overlay also quotes the Convex error.
  await expect(page.getByText(STALE, { exact: true })).toBeVisible();
  await expect(page).toHaveURL("/setup/team");
});

/** Counts submit events on the form: Enter must cause none, and so no save. */
const countSubmits = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { submits: number };
    w.submits = 0;
    document
      .getElementById("setup-form")!
      .addEventListener("submit", () => w.submits++);
  });
const submits = (page: Page) =>
  page.evaluate(() => (window as unknown as { submits: number }).submits);

test("Enter never triggers Save and exit", async ({ page }) => {
  await page.goto("/setup/team");
  await countSubmits(page);
  await aiUse(page).getByRole("radio", { name: "Not using AI" }).press("Enter");
  expect(await submits(page)).toBe(0);

  await page.goto("/setup/team?page=2");
  await countSubmits(page);
  await challenge(page, "Other").press("Enter");
  await challenge(page, "Other").check();
  await more(page).press("Enter");
  expect(await submits(page)).toBe(0);
  await expect(page).toHaveURL("/setup/team?page=2");
});

test("at 390px only the current step label shows, all stay named", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/setup/team");
  const steps = page.getByRole("list", { name: "Sprint setup" });
  const label = (name: string) =>
    steps.locator(".ltw-step-label", { hasText: name });
  await expect(
    steps.locator("[aria-current=step] .ltw-step-label"),
  ).toBeVisible();
  // Visually hidden, not removed: still one node for screen readers.
  await expect(label("Protected hour")).toHaveCount(1);
  expect(
    (await label("Protected hour").boundingBox())!.width,
  ).toBeLessThanOrEqual(1);
  expect(
    (await steps.locator("[aria-current=step] .ltw-step-label").boundingBox())!
      .width,
  ).toBeGreaterThan(50);
  await page.screenshot({ path: "output/screens/03-page1-390.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(label("Protected hour")).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`setup team passes axe on both pages, ${scheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/setup/team");
    await fillPage1(page);
    await expectAxeClean(page);
    // For the wireframe review (Step 6). output/ is git-ignored.
    await page.screenshot({ path: `output/screens/03-page1-${scheme}.png` });
    await next(page).click();
    await expect(page).toHaveURL("/setup/team?page=2");
    await challenge(page, "Staff are using AI differently").check();
    await challenge(page, "Lack of time to learn").check();
    await challenge(page, "Other").check();
    await expectAxeClean(page);
    await page.screenshot({ path: `output/screens/03-page2-${scheme}.png` });
  });
}
