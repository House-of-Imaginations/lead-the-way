import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const REASON = "Tick both checks to save.";
const ZONE = "Drag a file here or click to upload";
// A 1 by 1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const field = (page: Page, name: string) =>
  page.getByRole("textbox", { name, exact: true });
const saveButton = (page: Page) =>
  page.getByRole("button", { name: "Save project" });
const reviewed = (page: Page) =>
  page.getByRole("checkbox", {
    name: "I reviewed the output before using it in work.",
  });
const dataSafe = (page: Page) =>
  page.getByRole("checkbox", {
    name: "I did not include restricted client or personal information.",
  });

async function open(page: Page) {
  await signInAs(page, "dan");
  await page.goto("/me/project");
  await expect(
    page.getByRole("heading", { level: 1, name: "Apply it to your work" }),
  ).toBeVisible();
}

// Uncaught errors, which would raise the Next dev overlay.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test("save waits for both checks, with the reason beside it", async ({
  page,
}) => {
  resetDemo("week1");
  await open(page);
  await field(page, "Project title").fill("Weekly client report");
  await expect(saveButton(page)).toBeDisabled();
  await expect(page.getByText(REASON)).toBeVisible();
  await reviewed(page).check();
  await expect(saveButton(page)).toBeDisabled();
  await dataSafe(page).check();
  await expect(saveButton(page)).toBeEnabled();
  await expect(page.getByText(REASON)).toHaveCount(0);
});

test("the draft saves itself and survives a reload", async ({ page }) => {
  resetDemo("week1");
  await open(page);
  // Both edits land inside one debounce. The demo clock is frozen, so the
  // label reads the same after every save and can't tell two saves apart.
  await field(page, "Project title").fill("Weekly client report");
  await field(page, "How did you complete this task before?").fill(
    "Two hours by hand.",
  );
  await expect(page.getByText("Draft saved at 1:00 PM")).toBeVisible();
  await page.reload();
  await expect(field(page, "Project title")).toHaveValue(
    "Weekly client report",
  );
  await expect(
    field(page, "How did you complete this task before?"),
  ).toHaveValue("Two hours by hand.");
});

test("a refused save keeps the draft", async ({ page }) => {
  resetDemo("week1");
  await open(page);
  // No title, so the server refuses the save; pressed inside the debounce.
  await field(page, "How did you complete this task before?").fill(
    "Two hours by hand.",
  );
  await reviewed(page).check();
  await dataSafe(page).check();
  await saveButton(page).click();
  // Exact: the dev overlay also logs the refused mutation.
  await expect(
    page.getByText("Add a project title to save.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Draft saved at 1:00 PM")).toBeVisible();
  await page.reload();
  await expect(
    field(page, "How did you complete this task before?"),
  ).toHaveValue("Two hours by hand.");
});

test("Dan's example fills the form, and saving opens Reflect", async ({
  page,
}) => {
  resetDemo("week1");
  await open(page);
  await expect(page.locator("#reflect")).toHaveCount(0);
  await page.getByRole("button", { name: "Use Dan's example" }).click();
  await expect(field(page, "Project title")).toHaveValue(
    "AI-assisted weekly client reporting",
  );
  await expect(field(page, "What changed?")).toHaveValue(
    "The process now takes about 1 hour 20 minutes.",
  );
  await expect(
    page.getByRole("checkbox", { name: "Time saved" }),
  ).toBeChecked();
  await expect(field(page, "Headline result")).toHaveValue(
    "40 minutes saved per week",
  );
  // The example never ticks the checks for you.
  await expect(reviewed(page)).not.toBeChecked();
  await expect(dataSafe(page)).not.toBeChecked();

  await reviewed(page).check();
  await dataSafe(page).check();
  await saveButton(page).click();
  await expect(page.getByText("Project saved", { exact: true })).toBeVisible();

  const reflect = page.locator("#reflect");
  await expect(
    reflect.getByRole("heading", { name: "Reflect" }),
  ).toBeVisible();
  await reflect
    .getByRole("textbox", { name: "What I learned" })
    .fill("Check every figure it produces.");
  await reflect
    .getByRole("textbox", { name: "How you checked it" })
    .fill("Against the account system.");
  await reflect.getByRole("button", { name: "Save reflection" }).click();
  await expect(
    page.getByText("Reflection saved", { exact: true }),
  ).toBeVisible();

  await page.goto("/me/project#reflect");
  await expect(
    reflect.getByRole("textbox", { name: "What I learned" }),
  ).toHaveValue("Check every figure it produces.");
});

test("a screenshot uploads, a non-image is refused, and it can be removed", async ({
  page,
}) => {
  resetDemo("week1");
  await open(page);
  await field(page, "Project title").fill("Weekly client report");

  await page.getByLabel(ZONE).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByText("Upload a PNG or JPG.")).toBeVisible();

  await page.getByLabel(ZONE).setInputFiles({
    name: "shot.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  const shot = page.getByRole("img", { name: "Your supporting screenshot" });
  await expect(shot).toBeVisible();
  await page.reload();
  await expect(shot).toBeVisible();

  await page.getByRole("button", { name: "Remove file" }).click();
  await expect(shot).toHaveCount(0);
  await expect(page.getByLabel(ZONE)).toBeAttached();
});

test("the aside gives this week's session tip", async ({ page }) => {
  resetDemo("week2");
  await open(page);
  const aside = page.getByRole("complementary", { name: "Guidance" });
  await expect(aside).toContainText("Before you start");
  await expect(aside).toContainText("Don't upload confidential work files");
  await expect(aside).toContainText("From this week's session");
  await expect(
    aside.getByRole("heading", { name: "Reusable prompt templates" }),
  ).toBeVisible();
  // The script's draft for Dan, his and private until he presents it.
  await expect(field(page, "Project title")).toHaveValue(
    "AI-assisted weekly client reporting",
  );
});

test("M3 at 390: one column, a full-width save, no sideways scroll", async ({
  page,
  expectAxeClean,
}) => {
  resetDemo("week2");
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByRole("button", { name: "Use Dan's example" })).toBeVisible();
  await expect(
    page.getByText("Use approved tools and de-identified data."),
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Guidance" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Cancel" })).toBeHidden();
  const box = (await saveButton(page).boundingBox())!;
  expect(box.width).toBeGreaterThan(340);
  expect(box.height).toBeGreaterThanOrEqual(48);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectAxeClean(page);
  await page.screenshot({ path: "output/screens/M3-390.png", fullPage: true });
});

for (const scheme of ["light", "dark"] as const) {
  test(`12 is axe clean, ${scheme}`, async ({ page, expectAxeClean }) => {
    // Week 4: Dan's project is saved, so Reflect shows too.
    resetDemo("week4");
    await page.setViewportSize({ width: 1440, height: 1480 });
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await expect(page.locator("#reflect")).toBeVisible();
    await expectAxeClean(page);
    await page.screenshot({
      path: `output/screens/12-${scheme}.png`,
      fullPage: true,
    });
  });
}
