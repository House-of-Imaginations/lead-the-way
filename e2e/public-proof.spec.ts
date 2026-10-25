import type { Page } from "@playwright/test";
import { LOOKS, look, resetCareers } from "./careers";
import { signInAs } from "./demo";
import { expect, test } from "./fixtures";

// `/proof/[slug]`, signed out (P5): the badge, project and endorsement, and
// the reflection only while both of Amara's switches are on.
test.describe.configure({ mode: "serial" });

const REFLECTION =
  "“Cleaning took longer than the charts. I checked every total by hand before trusting the AI suggestions.”";
let path = "";

/** Amara makes (or reads) her link on 6 Prove it. */
async function proofPath(page: Page): Promise<string> {
  await signInAs(page, "amara");
  await page.goto("/careers/proof");
  const create = page.getByRole("button", { name: "Create link" });
  if (await create.isVisible()) await create.click();
  const link = page.getByText(/^\/proof\/.+/);
  await expect(link).toBeVisible();
  return (await link.textContent())!;
}

test.beforeAll(async ({ browser }) => {
  resetCareers("proof");
  const page = await browser.newPage();
  path = await proofPath(page);
  await page.close();
});

for (const { width, colorScheme } of LOOKS) {
  test(`public proof at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "Amara" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Data Fundamentals" }),
    ).toBeVisible();
    await expect(
      page.getByText("Tidy four store sales exports and show weekly trends."),
    ).toBeVisible();
    await expect(page.getByText(REFLECTION)).toBeVisible();
    await expect(page.getByText("Lena, Pathway Guide")).toBeVisible();
    await expect(
      page.getByText("Concept prototype. Not an official IBM product."),
    ).toBeVisible();
    // Never confidence, lessons or crew ("From Zero to Hero" is the brand).
    await expect(page.getByText(/confiden|lesson|\bcrew\b/i)).toHaveCount(0);
    await expectAxeClean(page);
  });
}

test("the reflection goes when either switch is off", async ({
  page,
  browser,
}) => {
  await look(page, 1440, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/proof");
  const off = page.getByRole("switch", {
    name: "Show my reflection on shared proof links",
  });
  await off.click();
  await expect(off).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Setting saved.", { exact: true })).toBeVisible();

  const visitor = await browser.newPage();
  await visitor.goto(path);
  await expect(
    visitor.getByRole("heading", { level: 1, name: "Amara" }),
  ).toBeVisible();
  await expect(visitor.getByText(REFLECTION)).toHaveCount(0);
  await visitor.close();

  await off.click();
  await expect(off).toHaveAttribute("aria-checked", "true");
});

test("a slug nobody holds is not found", async ({ page }) => {
  const res = await page.goto("/proof/nobody-holds-this");
  expect(res?.status()).toBe(404);
});
