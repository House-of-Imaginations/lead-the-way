import { LOOKS, look } from "./careers";
import { expect, test } from "./fixtures";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";

// L and DB Log in (`/login?track=career`). Plain /login stays the team's 02b.
for (const { width, colorScheme } of LOOKS) {
  test(`careers log in at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await page.goto("/login?track=career");
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Forgot password?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with IBMid" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start my Pivot Map" }),
    ).toHaveAttribute("href", "/careers/map/new");
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
    if (width === 1440) {
      await expect(
        page.getByRole("heading", { name: "Pick up where you left off." }),
      ).toBeVisible();
      await expect(page.getByText("Next up: lesson 2 of 4")).toBeVisible();
    } else {
      await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
    }
    await expectAxeClean(page);
  });
}

test("one neutral error, whatever was wrong", async ({ page }) => {
  await page.goto("/login?track=career");
  await page.getByLabel("Email", { exact: true }).fill("nobody@e2e.test");
  await page.getByLabel("Password", { exact: true }).fill("not the password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByText("Check your email and password and try again."),
  ).toBeVisible();
});

test("a careers page sends a signed-out visitor to the careers log in", async ({
  page,
}) => {
  await page.goto("/careers/week");
  await expect(page).toHaveURL("/login?next=%2Fcareers%2Fweek&track=career");
  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome back" }),
  ).toBeVisible();
});
