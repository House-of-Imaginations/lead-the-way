import { E2E_DOMAIN, resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

test.describe.configure({ mode: "serial" });
test.afterAll(() => resetDemo());

test("the clock shows in setup and moves the demo", async ({ page }) => {
  resetDemo();
  await signInAs(page, "priya");
  await page.goto("/setup/team");
  const clock = page.getByRole("region", { name: "Demo clock" });
  await expect(clock.getByText("Tue 1 Sep, 9:30 AM")).toBeVisible();
  await clock.getByRole("button", { name: "Move clock" }).click();
  await page.getByRole("menuitem", { name: /Week 1/ }).click();
  await expect(
    page
      .getByRole("region", { name: "Demo clock" })
      .getByText("Wed 9 Sep, 1:00 PM"),
  ).toBeVisible();
});

test("the clock shows in the app and links to the guide", async ({ page }) => {
  resetDemo("week2");
  await signInAs(page, "dan");
  await page.goto("/me");
  const clock = page.getByRole("region", { name: "Demo clock" });
  await clock.getByRole("button", { name: "Move clock" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Open guide" }),
  ).toHaveAttribute("href", "/guide");
});

test("a real workspace has no clock", async ({ page }) => {
  const email = `e2e-clock-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Kai Moreno", email, password: "a long enough password" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
  await page.goto("/setup/start");
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/setup\/team$/);
  await expect(page.getByRole("region", { name: "Demo clock" })).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`the clock passes axe and stays clear of the nav at ${width}`, async ({
    page,
    expectAxeClean,
  }) => {
    resetDemo("week1");
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, "priya");
    await page.goto("/manager");
    const box = await page
      .getByRole("region", { name: "Demo clock" })
      .boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(main!.x);
    await expectAxeClean(page);
  });
}
