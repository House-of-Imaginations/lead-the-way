import { LOOKS, look, resetCareers } from "./careers";
import { signInAs } from "./demo";
import { expect, test } from "./fixtures";

// 6 and D6 Prove it (`/careers/proof`): Amara after the proof step.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetCareers("proof"));

for (const { width, colorScheme } of LOOKS) {
  test(`proof at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await signInAs(page, "amara");
    await page.goto("/careers/proof");
    await expect(
      page.getByRole("heading", { level: 1, name: "Credential earned" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Data Fundamentals" }),
    ).toBeVisible();
    await expect(page.getByText("Earned 16 November 2026")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Project: Sales dashboard, Western suburbs stores",
      }),
    ).toBeVisible();
    await expect(page.getByText("Reviewed", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "“Built a clean, accurate dashboard from real sales data, and explained every choice.”",
      ),
    ).toBeVisible();
    await expect(page.getByText("Lena, Pathway Guide")).toBeVisible();
    await expect(
      page.getByLabel("How confident are you about your next career step?"),
    ).toHaveValue("4");
    await expect(page.getByText("4 of 5: Fairly confident")).toBeVisible();
    const next = page.getByRole("link", { name: "Next credential" });
    await expect(next).toHaveCount(1);
    await expect(next).toHaveAttribute("href", "/careers/journey");
    await expect(
      page.getByText(
        "Endorsements describe what you can do. They never promise a job.",
      ),
    ).toBeVisible();
    await expect(
      page
        .getByText("Concept prototype. Not an official IBM product.")
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    // The three-part line is the phone's.
    await expect(page.getByText("The field agrees")).toBeVisible({
      visible: width === 390,
    });
    await expectAxeClean(page);
  });
}

test("confidence is saved as it moves", async ({ page }) => {
  await look(page, 1440, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/proof");
  const slider = page.getByLabel(
    "How confident are you about your next career step?",
  );
  await slider.fill("5");
  await expect(page.getByText("5 of 5: Very confident")).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(slider).toHaveValue("5", { timeout: 1000 });
  }).toPass();
});

test("a move before hydration is still saved", async ({ page }) => {
  await look(page, 1440, "light");
  await signInAs(page, "amara");
  // Hold the page's scripts so the slider moves before React hydrates.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/_next/static/chunks/**/*.js", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/careers/proof", { waitUntil: "commit" });
  const slider = page.getByLabel(
    "How confident are you about your next career step?",
  );
  await slider.fill("2");
  release();
  await expect(page.getByText("2 of 5: A little confident")).toBeVisible();
  await expect(async () => {
    await page.reload();
    await expect(slider).toHaveValue("2", { timeout: 1000 });
  }).toPass();
});

test("Add to LinkedIn is simulated with a toast", async ({ page }) => {
  await look(page, 390, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/proof");
  await page.getByRole("button", { name: "Add to LinkedIn" }).click();
  await expect(
    page.getByText("Added to LinkedIn.", { exact: true }),
  ).toBeVisible();
});

test("the link is made once and keeps both switches", async ({ page }) => {
  await look(page, 1440, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/proof");
  await page.getByRole("button", { name: "Create link" }).click();
  const link = page.getByText(/^\/proof\/.+/);
  await expect(link).toBeVisible();
  const path = await link.textContent();
  await page.reload();
  await expect(page.getByText(path!)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create link" })).toHaveCount(
    0,
  );
  for (const name of [
    "Show my reflection on shared proof links",
    "Add this reflection to my proof",
  ])
    await expect(page.getByRole("switch", { name })).toHaveAttribute(
      "aria-checked",
      "true",
    );
});
