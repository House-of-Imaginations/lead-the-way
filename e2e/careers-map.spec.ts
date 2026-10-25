import { LOOKS, buildMap, look } from "./careers";
import { expect, test } from "./fixtures";

// 3 and D3 Your Pivot Map (`/careers/map`): from the draft cookie, signed out.
for (const { width, colorScheme } of LOOKS) {
  test(`pivot map at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await buildMap(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Your Pivot Map" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You already have" }),
    ).toBeVisible();
    for (const s of [
      "Sales reporting",
      "Leading a team",
      "Problem-solving",
      "Rosters and budgets",
    ])
      await expect(page.getByText(s, { exact: true })).toBeVisible();
    const save = page.getByRole("link", { name: "Save my map" });
    await expect(save).toHaveCount(1);
    await expect(save).toBeVisible();
    await expect(save).toHaveAttribute("href", "/signup?track=career");
    if (width === 390) {
      await expect(
        page.getByRole("heading", {
          name: "3 free credentials, about 9 weeks",
        }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
      await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
        "href",
        "/careers/map/new",
      );
    } else {
      await expect(
        page.getByRole("heading", { name: "About 9 weeks" }),
      ).toBeVisible();
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.getByText("Pivot Crews")).toBeVisible();
      await expect(nav.getByText("from Retail Store Manager")).toBeVisible();
      await expect(nav.getByRole("link", { name: "My map" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(
        nav.getByText("Your employer never sees this plan"),
      ).toBeVisible();
      await expect(
        page.getByText("Free IBM SkillsBuild credential, 3 weeks"),
      ).toHaveCount(3);
    }
    await expectAxeClean(page);
  });
}

test("a skill swaps the why, and the hours stay on the draft", async ({
  page,
}) => {
  await look(page, 390, "light");
  await buildMap(page);
  await expect(
    page.getByRole("button", { name: "Excel and data" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Why Excel and data?")).toBeVisible();
  await page.getByRole("button", { name: "Data visualisation" }).click();
  await expect(page.getByText("Why Data visualisation?")).toBeVisible();
  await expect(
    page.getByText("Example job ad: Data Analyst, Footscray"),
  ).toBeVisible();

  await page.getByRole("button", { name: "3 hrs" }).click();
  await expect(
    page.getByRole("heading", { name: "3 free credentials, about 6 weeks" }),
  ).toBeVisible();
  await expect(
    page.getByText("Weeks are worked out from the 3 hours a week you chose."),
  ).toBeVisible();
  // setHours wrote the draft: a reload keeps 3 hours.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("button", { name: "3 hrs" })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 1000 },
    );
  }).toPass();
});

test("with no draft, the map starts one", async ({ page }) => {
  await page.goto("/careers/map");
  await expect(page).toHaveURL("/careers/map/new");
});
