import { LOOKS, PARTNER, look } from "./careers";
import { expect, test } from "./fixtures";

// 1 Discover (`/p/[partner]`): public, signed out.
for (const { width, colorScheme } of LOOKS) {
  test(`discover at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await page.goto(`/p/${PARTNER}`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Change careers with a crew.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Opened from Footscray Library")).toBeVisible();
    await expect(page.getByText("No cost, no card")).toBeVisible();
    await expect(
      page.getByText(
        "Free IBM SkillsBuild credentials. Concept prototype. Not an official IBM product.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?track=career",
    );
    await expect(
      page.getByRole("link", { name: "Start my map" }),
    ).toHaveAttribute("href", `/careers/map/new?partner=${PARTNER}`);
    await expectAxeClean(page);
  });
}

test("an unknown partner is not found", async ({ page }) => {
  const res = await page.goto("/p/no-such-partner");
  expect(res?.status()).toBe(404);
});

test("start my map opens tell us", async ({ page }) => {
  await page.goto(`/p/${PARTNER}`);
  await page.getByRole("link", { name: "Start my map" }).click();
  await expect(page).toHaveURL(`/careers/map/new?partner=${PARTNER}`);
});
