import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const REQUIRED = [
  "Why your team needs shared AI norms",
  "Supporting AI learning without micromanaging",
  "Creating your Team AI Agreement",
];
const FIRST_COACHING = "Starting honest conversations about AI use";
const RATING =
  "How confident do you feel setting shared AI norms with your team?";

const moduleButton = (page: Page, title: string) =>
  page.getByRole("button", { name: title });
const progress = (page: Page) =>
  page.getByRole("progressbar", { name: "Progress", exact: true });
const rating = (page: Page) => page.getByRole("group", { name: RATING });

async function open(page: Page) {
  await signInAs(page, "priya");
  await page.goto("/manager/learning");
}

async function markComplete(page: Page, title: string) {
  await moduleButton(page, title).click();
  await page.getByRole("button", { name: "Mark as complete" }).click();
  await expect(moduleButton(page, title).getByText("Completed")).toBeVisible();
}

async function completeRequired(page: Page) {
  for (const title of REQUIRED) await markComplete(page, title);
}

// Uncaught errors, which would raise the Next dev overlay.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  resetDemo();
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test("modules complete in order", async ({ page }) => {
  await open(page);
  const mark = page.getByRole("button", { name: "Mark as complete" });
  await expect(moduleButton(page, REQUIRED[0])).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    "0 of 3 complete",
  );

  // Selecting a locked module moves the selection, not the state tags.
  await moduleButton(page, REQUIRED[1]).click();
  await expect(moduleButton(page, REQUIRED[1])).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(
    moduleButton(page, REQUIRED[1]).getByText("Not started"),
  ).toBeVisible();
  await expect(
    moduleButton(page, REQUIRED[0]).getByText("In progress"),
  ).toBeVisible();
  await expect(mark).toBeDisabled();
  await expect(mark).toHaveAccessibleDescription(
    "Finish the earlier modules first.",
  );

  await markComplete(page, REQUIRED[0]);
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    "1 of 3 complete",
  );
  await expect(
    page.getByText("1 of 3 complete", { exact: true }),
  ).toBeVisible();
  await expect(moduleButton(page, REQUIRED[1])).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByText("Module 2 of 3", { exact: true })).toBeVisible();
  await expect(mark).toBeEnabled();
  await expect(
    moduleButton(page, REQUIRED[2]).getByText("Not started"),
  ).toBeVisible();

  await moduleButton(page, REQUIRED[0]).click();
  await expect(mark).toBeDisabled();
  await expect(mark).toHaveAccessibleDescription(
    "You've completed this module.",
  );
});

test("the header and rows follow the PNG", async ({ page }) => {
  await open(page);
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "My learning" }),
  ).toHaveAttribute("href", "/manager/learning");
  await expect(
    page.getByRole("button", { name: "Mark as complete" }).locator("svg"),
  ).toHaveCount(1);

  // Minutes in the right column, the tag under the objective.
  const row = moduleButton(page, REQUIRED[0]);
  const minutes = await row.getByText("5 min", { exact: true }).boundingBox();
  const tag = await row.getByText("In progress", { exact: true }).boundingBox();
  const objective = await row
    .getByText("See why consistent, visible AI use", { exact: false })
    .boundingBox();
  expect(minutes!.x).toBeGreaterThan(objective!.x + objective!.width - 1);
  expect(tag!.y).toBeGreaterThan(objective!.y);
  expect(tag!.x).toBeCloseTo(objective!.x, 0);
});

test("tapping a row at 390 brings the player into view", async ({
  page,
  expectAxeClean,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await moduleButton(page, FIRST_COACHING).click();
  await expect(page.locator("video")).toHaveAttribute(
    "aria-label",
    FIRST_COACHING,
  );
  await expect(page.locator("video")).toBeInViewport();
  // "Mark as complete" keeps its 16px padding right of the check icon.
  const mark = page.getByRole("button", { name: "Mark as complete" });
  const button = await mark.boundingBox();
  const icon = await mark.locator("svg").boundingBox();
  expect(icon!.x + icon!.width).toBeLessThanOrEqual(
    button!.x + button!.width - 16 + 0.5,
  );
  await expectAxeClean(page);
  await page.screenshot({ path: "output/screens/05-390.png", fullPage: true });
});

test("captions are on by default", async ({ page }) => {
  await open(page);
  const video = page.locator("video");
  await expect(video).toHaveAttribute("aria-label", REQUIRED[0]);
  await expect(video.locator("track")).toHaveAttribute(
    "src",
    "/pathway/shared-norms.vtt",
  );
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0]?.mode))
    .toBe("showing");

  await moduleButton(page, REQUIRED[1]).click();
  await expect(video).toHaveAttribute("aria-label", REQUIRED[1]);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0]?.mode))
    .toBe("showing");
});

test("Open transcript shows the captions text", async ({ page }) => {
  await open(page);
  const trigger = page.getByRole("button", { name: "Open transcript" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Transcript" });
  await expect(dialog).toContainText(
    "Placeholder captions. The final video is on its way.",
  );
  await expect(dialog).toContainText(
    "Captions and the transcript arrive with the final video.",
  );
  await expect(dialog).not.toContainText("-->");
  await expect(dialog).not.toContainText("WEBVTT");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Ready to launch appears after the third module", async ({ page }) => {
  await open(page);
  const heading = page.getByRole("heading", { name: "Ready to launch?" });
  await markComplete(page, REQUIRED[0]);
  await markComplete(page, REQUIRED[1]);
  await expect(heading).toHaveCount(0);
  await expect(rating(page)).toHaveCount(0);

  await markComplete(page, REQUIRED[2]);
  await expect(heading).toBeVisible();
  await expect(
    page.getByText("You've finished the manager pathway."),
  ).toBeVisible();
  await expect(rating(page)).toBeVisible();
  await expect(rating(page).getByRole("radio")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Continue to agreement" }),
  ).toBeEnabled();
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    "3 of 3 complete",
  );
});

test("Continue to agreement saves the rating", async ({ page }) => {
  await open(page);
  await completeRequired(page);
  await rating(page).getByRole("radio", { name: "4", exact: true }).check();
  await page.getByRole("button", { name: "Continue to agreement" }).click();
  await expect(page).toHaveURL("/manager/agreement");

  await page.goto("/manager/learning");
  await expect(
    rating(page).getByRole("radio", { name: "4", exact: true }),
  ).toBeChecked();
});

test("Continue to agreement without a rating saves nothing", async ({
  page,
}) => {
  await open(page);
  await completeRequired(page);
  await page.getByRole("button", { name: "Continue to agreement" }).click();
  await expect(page).toHaveURL("/manager/agreement");

  await page.goto("/manager/learning");
  await expect(rating(page)).toBeVisible();
  await expect(rating(page).getByRole("radio", { checked: true })).toHaveCount(
    0,
  );
});

test("the coaching path lists four modules and its percent", async ({
  page,
}) => {
  await open(page);
  const list = page.getByRole("list", { name: "Leading AI in Your Team" });
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByText("0% complete", { exact: true })).toBeVisible();

  await markComplete(page, FIRST_COACHING);
  await expect(page.getByText("25% complete", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Coaching module 2 of 4", { exact: true }),
  ).toBeVisible();
  // Coaching minutes never count toward the required three.
  await expect(progress(page)).toHaveAttribute(
    "aria-valuetext",
    "0 of 3 complete",
  );
});

for (const scheme of ["light", "dark"] as const) {
  test(`05 is axe clean, ${scheme}`, async ({ page, expectAxeClean }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    // The PNG's state: module 1 done, module 2 open.
    await markComplete(page, REQUIRED[0]);
    await expectAxeClean(page);
    await page.screenshot({
      path: `output/screens/05-${scheme}.png`,
      fullPage: true,
    });

    await page.getByRole("button", { name: "Open transcript" }).click();
    await expect(
      page.getByRole("dialog", { name: "Transcript" }),
    ).toContainText("Placeholder captions");
    await expectAxeClean(page);
  });
}
