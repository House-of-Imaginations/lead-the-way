import { LOOKS, look, resetCareers } from "./careers";
import { signInAs } from "./demo";
import { expect, test } from "./fixtures";

// 7 Keep going (`/careers/journey`): Amara in week 2 after a missed week
// (P6). Week 2's lessons are 4 to 7; she did 4, so she picks up at the
// second, 15 minutes in the catalog.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetCareers("week2", "missedWeek"));

for (const { width, colorScheme } of LOOKS) {
  test(`keep going at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await signInAs(page, "amara");
    await page.goto("/careers/journey");
    await expect(page.getByText("Missed last week? No problem.")).toBeVisible();
    await expect(
      page.getByText("Pick up at lesson 2 of 4, 15 minutes."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome back, Amara" }),
    ).toBeVisible();
    await expect(page.getByText("never a lost streak")).toBeVisible();
    const steps = page.getByRole("list", { name: "Your credentials" });
    for (const name of [
      "Data Fundamentals",
      "Data visualisation",
      "AI Fundamentals",
    ])
      await expect(steps.getByText(name)).toBeVisible();
    await expect(
      steps.locator("[aria-current=step]").getByText("Data Fundamentals"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Credential 1: Data Fundamentals" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Lena is your guide. Your crew checks in Tuesdays 7 to 8 PM.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Become a guide later" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Resume" })).toHaveAttribute(
      "href",
      "/careers/week",
    );
    await expect(
      page
        .getByText("Concept prototype. Not an official IBM product.")
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expectAxeClean(page);
  });
}

test("the banner dismisses, and comes back on the next visit", async ({
  page,
}) => {
  await look(page, 390, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/journey");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Missed last week? No problem.")).toHaveCount(0);
  // Nothing about a missed week is stored (P6).
  await page.reload();
  await expect(page.getByText("Missed last week? No problem.")).toBeVisible();
});

test("after the badge, the next crew is credential 2", async ({ page }) => {
  resetCareers("proof");
  await look(page, 1440, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/journey");
  await expect(
    page.getByRole("heading", { name: "Credential 2: Data visualisation" }),
  ).toBeVisible();
  await expect(page.getByText("Next crew", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Lena stays your guide. You join changers at the same stage, Tuesdays 7 to 8 PM.",
    ),
  ).toBeVisible();
});
