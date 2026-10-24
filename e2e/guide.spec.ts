import { demoPassword, resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetDemo());
test.afterAll(() => resetDemo());

test("signed out, the guide asks you to log in first", async ({ page }) => {
  await page.goto("/guide");
  await expect(page).toHaveURL(/\/login\?next=%2Fguide$/);
});

test("the guide shows Main.png's sections and copy", async ({ page }) => {
  await signInAs(page, "priya");
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { level: 1, name: "From Zero to Hero" }),
  ).toBeVisible();
  for (const text of [
    "A manager-first SkillsBuild team path. Priya learns first, sets shared AI norms and protects one paid hour a week. Dan learns inside that hour, applies it to a real task and shows what changed.",
    "make AI learning part of the working week for professionals aged 25 to 40 in AI-exposed roles, so that what they learn is used, completed and openly valued at work?",
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
      await expect(page.getByLabel("Shared password")).toBeVisible();
      await expectAxeClean(page);
      const spill = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(spill).toBe(false);
    });
  }
}

test("the demo section shows the time, the accounts and the counts", async ({
  page,
}) => {
  resetDemo();
  await signInAs(page, "priya");
  await page.goto("/guide");
  const demo = page.getByRole("region", { name: "Demo controls" });
  await expect(demo.getByText("Tuesday 1 September at 9:30 AM")).toBeVisible();
  await expect(demo.getByText("priya.raman@calderlane.com.au")).toBeVisible();
  await expect(demo.getByText("dan.okafor@calderlane.com.au")).toBeVisible();
  await expect(demo.getByText("Sprints launched")).toBeVisible();
});

test("the shared password shows only to a demo seat, masked", async ({
  page,
}) => {
  resetDemo();
  await signInAs(page, "priya");
  await page.goto("/guide");
  const field = page.getByLabel("Shared password");
  await expect(field).toHaveAttribute("type", "password");
  // Compare in the page so a failure never prints the password.
  const matches = await field.evaluate(
    (el, pw) => (el as HTMLInputElement).value === pw,
    demoPassword(),
  );
  expect(matches).toBe(true);
});

test("Move clock jumps to the chosen week", async ({ page }) => {
  resetDemo();
  await signInAs(page, "priya");
  await page.goto("/guide");
  await page.getByLabel("Move the demo to").selectOption("week2");
  await page.getByRole("button", { name: "Move clock" }).click();
  await expect(
    page.getByText("Wednesday 16 September at 1:00 PM"),
  ).toBeVisible();
});

test("Start as Dan at setup jumps to week 1 and lands on Dan's home", async ({
  page,
}) => {
  resetDemo();
  await signInAs(page, "priya");
  await page.goto("/guide");
  await page.getByRole("button", { name: "Start as Dan" }).first().click();
  await expect(page).toHaveURL(/\/me$/);
  await page.goto("/guide");
  await expect(
    page.getByText("Wednesday 9 September at 1:00 PM"),
  ).toBeVisible();
});

test("a Dan step switches from Priya to Dan", async ({ page }) => {
  resetDemo("week2");
  await signInAs(page, "priya");
  await page.goto("/guide");
  // The tiles switch only once demo.status has loaded.
  await expect(page.getByRole("button", { name: "Move clock" })).toBeVisible();
  await page.getByRole("link", { name: /Applies it to real work/ }).click();
  await expect(page).toHaveURL(/\/me\/project$/);
});

test("reset as Dan ends as Priya at setup", async ({ page }) => {
  resetDemo("week1");
  await signInAs(page, "dan");
  await page.goto("/guide");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo" })
    .click();
  await expect(page.getByText("You're signed in as Priya")).toBeVisible();
  await expect(page.getByText("Tuesday 1 September at 9:30 AM")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start as Dan" }).first(),
  ).toBeVisible();
});

test("an account without a demo seat sees only Start as Priya", async ({
  page,
}) => {
  resetDemo();
  await signInAs(page, "dan"); // no seat until 8 September
  await page.goto("/guide");
  await expect(
    page.getByRole("heading", { level: 1, name: "From Zero to Hero" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start as Priya" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Move clock" })).toHaveCount(0);
  await expect(page.getByLabel("Shared password")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start as Dan" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Start as Priya" }).click();
  await expect(page.getByText("You're signed in as Priya")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move clock" })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`the reset modal passes axe, ${theme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await signInAs(page, "priya");
    await page.goto("/guide");
    await page.getByRole("button", { name: "Reset demo" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectAxeClean(page);
  });
}
