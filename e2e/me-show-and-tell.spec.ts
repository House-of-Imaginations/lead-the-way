import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const TITLE = "AI-assisted weekly client reporting";
const PRESENTED = "Presented to your team.";
const DONE = "You presented this project.";
const CONFIRM =
  "Your project title, before, change, after and headline become visible to your team and your manager. Your course activity stays private.";
const NO_BADGE = "Your badge appears when you finish the course.";
const AFTER = "How did the sprint go?";
const CHECKS = [
  "I reviewed the output before using it in work.",
  "I did not include restricted client or personal information.",
];

const main = (page: Page) => page.getByRole("main");
const project = (page: Page) => page.getByRole("region", { name: TITLE });
const session = (page: Page) =>
  page.getByRole("list", { name: "In this session" });
const presentButton = (page: Page) =>
  page.getByRole("button", { name: "Present to team" });
const addButton = (page: Page) =>
  page.getByRole("button", { name: "Add to badge" });
const confirm = (page: Page) =>
  page.getByRole("dialog", { name: "Present to your team?" });

// Uncaught errors, which would raise the Next dev overlay.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

async function open(page: Page) {
  await signInAs(page, "dan");
  await page.goto("/me/show-and-tell");
  await expect(
    page.getByRole("heading", { level: 1, name: "Team AI show and tell" }),
  ).toBeVisible();
}

test.describe("week 4", () => {
  test.beforeEach(() => resetDemo("week4"));

  test("14 reads as the wireframe before anyone presents", async ({ page }) => {
    await open(page);
    await expect(main(page).getByText("Week 4", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Share what changed, not just what you completed.", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      project(page).getByText("Your project", { exact: true }),
    ).toBeVisible();
    await expect(
      project(page).getByText("40 minutes saved per week", { exact: true }),
    ).toBeVisible();
    await expect(project(page).getByRole("term")).toHaveText([
      "Before",
      "What I changed",
      "After",
    ]);
    await expect(project(page).getByRole("definition").nth(0)).toHaveText(
      "Weekly client reports took about 2 hours to pull together from account notes.",
    );
    await expect(
      project(page).getByText("Output reviewed", { exact: true }),
    ).toBeVisible();
    await expect(
      project(page).getByText("No restricted data", { exact: true }),
    ).toBeVisible();
    // Not reflected yet: the script adds what Dan learned after the hour.
    await expect(
      project(page).getByText("What I learned", { exact: true }),
    ).toHaveCount(0);

    await expect(
      page.getByRole("link", { name: "Edit reflection" }),
    ).toHaveAttribute("href", "/me/project#reflect");
    await expect(addButton(page)).toBeEnabled();
    await expect(presentButton(page)).toBeEnabled();

    await expect(session(page)).toHaveCount(0);
    await expect(
      page.getByText("No one has presented yet.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Everyone chose to share. Nothing is shared automatically.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Discuss as a team" })
        .getByRole("listitem"),
    ).toHaveText([
      "What worked?",
      "What failed, and how did you notice?",
      "What should we add to our Team AI Agreement?",
    ]);
    // Week 4 and not answered yet: the after check-in waits here (Ruling 7).
    await expect(page.getByText(AFTER, { exact: true })).toBeVisible();
  });

  test("presenting asks first, then the board lists Dan", async ({ page }) => {
    await open(page);
    await presentButton(page).click();
    await expect(confirm(page)).toContainText("Show and tell");
    await expect(confirm(page)).toContainText(CONFIRM);
    await confirm(page).getByRole("button", { name: "Cancel" }).click();
    await expect(confirm(page)).toHaveCount(0);
    await expect(presentButton(page)).toBeFocused();
    await expect(
      page.getByText("No one has presented yet.", { exact: true }),
    ).toBeVisible();

    await presentButton(page).click();
    await confirm(page)
      .getByRole("button", { name: "Present project" })
      .click();
    await expect(page.getByText(PRESENTED, { exact: true })).toBeVisible();
    await expect(confirm(page)).toHaveCount(0);
    await expect(session(page).getByRole("listitem")).toHaveText([
      new RegExp(`^${TITLE}\\s*Dan$`),
    ]);
    await expect(presentButton(page)).toHaveCount(0);
    await expect(page.getByText(DONE, { exact: true })).toBeVisible();
    // The trigger went away; focus lands on the line that replaced it.
    await expect(page.getByText(DONE, { exact: true })).toBeFocused();

    // Convex holds it: still presented after a reload.
    await page.reload();
    await expect(session(page).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText(DONE, { exact: true })).toBeVisible();
  });

  test("adding the reflection to the badge goes to the credential", async ({
    page,
  }) => {
    await open(page);
    await addButton(page).click();
    await expect(page).toHaveURL("/me/credential");
  });

  test("at 390 the tiles stack and the buttons are full touch targets @mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const tiles = await project(page).getByRole("term").all();
    const [before, changed, after] = await Promise.all(
      tiles.map((t) => t.boundingBox()),
    );
    expect(changed!.y).toBeGreaterThan(before!.y);
    expect(after!.y).toBeGreaterThan(changed!.y);
    expect(changed!.x).toBe(before!.x);
    for (const button of [
      page.getByRole("link", { name: "Edit reflection" }),
      addButton(page),
      presentButton(page),
    ]) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`14 is axe clean, ${scheme}`, async ({ page, expectAxeClean }) => {
      await page.setViewportSize({ width: 1440, height: 1060 });
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await expect(presentButton(page)).toBeVisible();
      await expectAxeClean(page);
      // output/ is git-ignored: the scratch copy Step 7 compares with the PNG.
      await page.screenshot({
        path: `output/screens/14-${scheme}.png`,
        fullPage: true,
      });
      await presentButton(page).click();
      await expect(confirm(page)).toBeVisible();
      await expectAxeClean(page);
    });
  }
});

test("at complete, the board lists every presented project in order", async ({
  page,
}) => {
  resetDemo("complete");
  await open(page);
  // presentedAt ascending (spec rule 10): Dan presented first at 2:30 PM.
  await expect(session(page).getByRole("listitem")).toHaveText([
    /^AI-assisted weekly client reporting\s*Dan$/,
    /^Meeting notes to action lists\s*Mei$/,
    /^First drafts of client follow-up emails\s*Sarah$/,
    /^Summarising account research\s*Tomás$/,
    /^Proposal section drafts\s*Aisha$/,
    /^Checking spreadsheet formulas\s*Luca$/,
  ]);
  await expect(
    project(page).getByText("What I learned", { exact: true }),
  ).toBeVisible();
  await expect(
    project(page).getByText(
      "“AI helped speed up the first draft, but I still needed to verify the client metrics manually.”",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(DONE, { exact: true })).toBeVisible();
  // The script answered Dan's after check-in at 3:30 PM: no card.
  await expect(page.getByText(AFTER, { exact: true })).toHaveCount(0);
});

test("a draft stays off the page until it is saved", async ({ page }) => {
  // Week 2: Dan has a draft (week1.session), never saved.
  resetDemo("week2");
  await open(page);
  await expect(
    page.getByText("Save your work project first.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open work project" }),
  ).toHaveAttribute("href", "/me/project");
  await expect(page.getByText(TITLE)).toHaveCount(0);
  await expect(presentButton(page)).toHaveCount(0);
  await expect(main(page).getByText("Week 4", { exact: true })).toHaveCount(0);
  await expect(page.getByText(AFTER, { exact: true })).toHaveCount(0);
});

test("without a badge, adding the reflection waits and says why", async ({
  page,
}) => {
  // Week 3: Dan's badge comes on 24 September, so save the draft first.
  resetDemo("week3");
  await signInAs(page, "dan");
  await page.goto("/me/project");
  for (const label of CHECKS) await page.getByLabel(label).check();
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(
    page.getByRole("button", { name: "Save reflection" }),
  ).toBeVisible();

  await page.goto("/me/show-and-tell");
  await expect(addButton(page)).toBeDisabled();
  await expect(addButton(page)).toHaveAccessibleDescription(NO_BADGE);
  await expect(page.getByText(NO_BADGE, { exact: true })).toBeVisible();
  // Presenting needs only a saved project (Ruling 13).
  await expect(presentButton(page)).toBeEnabled();
});
