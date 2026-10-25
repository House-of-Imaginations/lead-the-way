import { LOOKS, PARTNER, look } from "./careers";
import { expect, test } from "./fixtures";

// 2 Tell us about you (`/careers/map/new`): public, signed out.
for (const { width, colorScheme } of LOOKS) {
  test(`tell us at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await page.goto(`/careers/map/new?partner=${PARTNER}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Where are you now?" }),
    ).toBeVisible();
    await expect(page.getByText("Step 1 of 2, about 2 minutes")).toBeVisible();
    await expect(page.getByLabel("Current role")).toHaveValue(
      "Retail Store Manager",
    );
    await expect(page.getByLabel("Where do you want to go?")).toHaveValue(
      "data-analyst",
    );
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      `/p/${PARTNER}`,
    );
    await expect(
      page.getByText("Concept prototype. Not an official IBM product."),
    ).toBeVisible();
    await expectAxeClean(page);
  });
}

test("build my map waits for consent, and the hours line follows the switcher", async ({
  page,
}) => {
  await page.goto("/careers/map/new");
  const build = page.getByRole("button", { name: "Build my map" });
  await expect(build).toBeDisabled();
  await expect(page.getByText("Tick the box above to continue.")).toBeVisible();
  await expect(
    page.getByText("At 2 hours a week, your map takes about 9 weeks."),
  ).toBeVisible();
  await page.getByRole("button", { name: "1 hr" }).click();
  await expect(
    page.getByText("At 1 hour a week, your map takes about 18 weeks."),
  ).toBeVisible();
  await page.getByRole("button", { name: "3 hrs" }).click();
  await expect(
    page.getByText("At 3 hours a week, your map takes about 6 weeks."),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await expect(build).toBeEnabled();
  await expect(page.getByText("Tick the box above to continue.")).toHaveCount(
    0,
  );
  // Without a partner, back goes to the track choice.
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
    "href",
    "/start",
  );
});

test("the answers come back from the draft", async ({ page }) => {
  await page.goto("/careers/map/new");
  await page.getByLabel("Current role").selectOption("Primary Teacher");
  await page
    .getByLabel("Where do you want to go?")
    .selectOption("business-analyst");
  await page.getByRole("button", { name: "1 hr" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Build my map" }).click();
  await expect(page).toHaveURL("/careers/map");
  await page.goto("/careers/map/new");
  await expect(page.getByLabel("Current role")).toHaveValue("Primary Teacher");
  await expect(page.getByLabel("Where do you want to go?")).toHaveValue(
    "business-analyst",
  );
  await expect(page.getByRole("button", { name: "1 hr" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
