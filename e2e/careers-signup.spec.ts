import { LOOKS, PARTNER, buildMap, look } from "./careers";
import { E2E_DOMAIN } from "./demo";
import { expect, test } from "./fixtures";

const freshEmail = () =>
  `e2e-pivot-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;

// 3b and DA Save your map (`/signup?track=career`).
for (const { width, colorScheme } of LOOKS) {
  test(`save your map at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await buildMap(page);
    await page.goto("/signup?track=career");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create your free account" }),
    ).toBeVisible();
    await expect(page.getByLabel("First name")).toBeVisible();
    await expect(
      page.getByText(
        "Use a personal email. No employer is ever linked to this account.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create free account" }),
    ).toBeDisabled();
    await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login?track=career",
    );
    // The map summary: above the form on a phone, in the panel on a laptop.
    await expect(
      page.getByText("skills to build").filter({ visible: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText("weeks at 2 hrs").filter({ visible: true }),
    ).toHaveCount(1);
    if (width === 390) {
      await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
        "href",
        "/careers/map",
      );
    } else {
      await expect(
        page.getByRole("heading", { name: "Your map is ready." }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Pivot Crews" }),
      ).toBeVisible();
    }
    await expectAxeClean(page);
  });
}

test("continue with IBMid explains it isn't connected", async ({ page }) => {
  await page.goto("/signup?track=career");
  await page.getByRole("button", { name: "Continue with IBMid" }).click();
  const dialog = page.getByRole("dialog", { name: "IBMid isn't connected" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Use email" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
});

test("the full path: partner page, tell us, map, sign up, then home", async ({
  page,
}) => {
  await page.goto(`/p/${PARTNER}`);
  await page.getByRole("link", { name: "Start my map" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Build my map" }).click();
  await expect(page).toHaveURL("/careers/map");
  await page.getByRole("link", { name: "Save my map" }).click();
  await expect(page).toHaveURL("/signup?track=career");

  await page.getByLabel("First name").fill("Ama");
  await page.getByLabel("Email", { exact: true }).fill(freshEmail());
  await page
    .getByLabel("Password", { exact: true })
    .fill("a long enough password");
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await page.getByRole("button", { name: "Create free account" }).click();
  // `viewer.home` for a career-only account: a holding page until P13b.
  await expect(page).toHaveURL("/careers/journey");
  await expect(
    page.getByRole("heading", { name: "Your map is saved" }),
  ).toBeVisible();

  // Sign-up claimed the draft: the map is the saved one, in the member shell.
  await page.goto("/careers/map");
  await expect(page).toHaveURL("/careers/map");
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Pivot Map" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Save my map" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "This week" }).first(),
  ).toHaveAttribute("href", "/careers/week");
});
