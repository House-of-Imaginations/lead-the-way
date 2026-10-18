import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetDemo());

test("signed out, the guide asks you to log in first", async ({ page }) => {
  await page.goto("/guide");
  await expect(page).toHaveURL(/\/login\?next=%2Fguide$/);
});

test("the guide shows Main.png's sections and copy", async ({ page }) => {
  await signInAs(page, "priya");
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { level: 1, name: "Lead the Way" }),
  ).toBeVisible();
  for (const text of [
    "A manager-first SkillsBuild team path. Priya learns first, sets shared AI norms and protects one paid hour a week. Dan learns inside that hour, applies it to a real task and shows what changed.",
    "make AI learning part of the working week for mid-career professionals in AI-exposed roles, so that what they learn is used, completed and openly valued at work?",
    "Open any step. The account menu switches between Priya and Dan, and prototype notes show the research behind each screen.",
    "Will managers commit one protected hour per employee per week?",
    "These are prototype test criteria, not verified product outcomes. All data is mocked. Course completion, invitations, calendar holds, badge issuance and sharing are simulated. Company, association and people are fictional.",
  ]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  for (const name of [
    "Walkthrough",
    "Assumptions under test",
    "Manager test",
    "Team pilot",
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Start the walkthrough/ }),
  ).toHaveAttribute("href", "/demo/partner-email");
});

test("each walkthrough step links to its screen", async ({ page }) => {
  await signInAs(page, "priya");
  await page.goto("/guide");
  const steps: [string, string][] = [
    ["Accepts the invitation", "/demo/partner-email"],
    ["Protects one hour", "/setup/protected-hour"],
    ["Completes the pathway", "/manager/learning"],
    ["Sets norms and launches", "/manager/agreement"],
    ["Joins the sprint", "/me"],
    ["Applies it to real work", "/me/project"],
    ["Shares what changed", "/me/show-and-tell"],
    ["Sees team outcomes", "/manager/outcomes"],
  ];
  for (const [title, href] of steps) {
    await expect(
      page.getByRole("link", { name: new RegExp(title) }),
    ).toHaveAttribute("href", href);
  }
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`the guide passes axe, ${theme} at ${width}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await signInAs(page, "priya");
      await page.goto("/guide");
      await expectAxeClean(page);
      const spill = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(spill).toBe(false);
    });
  }
}
