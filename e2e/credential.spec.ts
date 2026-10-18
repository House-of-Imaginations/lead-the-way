import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { demoBadgeSlug, resetDemo, signInAs } from "./demo";

const publicPath = () => `/credential/${demoBadgeSlug()}`;
const PROJECT = "AI-assisted weekly client reporting";
const SKILLS = [
  "AI prompting",
  "Critical evaluation",
  "Responsible AI",
  "Workflow improvement",
];
const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const PROMISE =
  "You choose what goes on your credential. Your course activity and time spent are never shown.";
const NO_BADGE =
  "Your badge appears here when you finish AI Productivity Fundamentals.";

const main = (page: Page) => page.getByRole("main");
const badge = (page: Page) =>
  page.getByRole("region", { name: "AI Fundamentals" });
const applied = (page: Page) =>
  page.getByRole("region", { name: "Applied at work" });
const copyButton = (page: Page) =>
  page.getByRole("button", { name: "Copy credential link" });
const linkedInButton = (page: Page) =>
  page.getByRole("button", { name: "Share on LinkedIn" });

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

/** The two cards, as both pages show them once the reflection is linked. */
async function expectCredential(page: Page) {
  await expect(badge(page)).toContainText("IBM SkillsBuild badge");
  await expect(badge(page)).toContainText("Completed 24 September 2026");
  await expect(badge(page)).toContainText("Badge = I learned it.");
  await expect(applied(page).getByRole("term")).toHaveText([
    "Project",
    "Application",
    "Skills shown",
  ]);
  await expect(applied(page).getByRole("definition").first()).toHaveText(
    PROJECT,
  );
  await expect(applied(page).getByRole("listitem")).toHaveText(SKILLS);
  await expect(applied(page)).toContainText("Shared at show and tell, 30 Sep");
  await expect(applied(page)).toContainText("Applied reflection = I used it.");
}

test.describe("complete", () => {
  test.beforeAll(() => resetDemo("complete"));

  test("15 shows the badge and the applied reflection", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:3000",
    });
    await signInAs(page, "dan");
    await page.goto("/me/credential");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your credential" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Your existing SkillsBuild badge, with evidence of how you used it at work.",
        { exact: true },
      ),
    ).toBeVisible();
    await expectCredential(page);
    await expect(page.getByText(PROMISE, { exact: true })).toBeVisible();

    await copyButton(page).click();
    await expect(
      page.getByText("Credential link copied.", { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `http://localhost:3000${publicPath()}`,
    );
    await linkedInButton(page).click();
    await expect(
      page.getByText("Simulated in this prototype.", { exact: true }),
    ).toBeVisible();
  });

  test("the public link shows the badge and reflection signed out, and nothing else", async ({
    page,
  }) => {
    const res = await page.goto(publicPath());
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dan Okafor" }),
    ).toBeVisible();
    await expect(page.getByText("Lead the Way", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Shared by Dan Okafor", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(DISCLAIMER, { exact: true })).toBeVisible();
    await expectCredential(page);
    // No shell, no buttons, no promise addressed to Dan.
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await expect(main(page).getByRole("button")).toHaveCount(0);
    await expect(page.getByText(PROMISE, { exact: true })).toHaveCount(0);
    // Course progress and time never reach this page.
    await expect(main(page).getByText(/\d+%|sessions? done/i)).toHaveCount(0);
  });

  test("an unknown slug is a 404", async ({ page }) => {
    const res = await page.goto("/credential/nobody-ai-fundamentals");
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "We couldn't find that page.",
      }),
    ).toBeVisible();
  });

  test("M4: at 390 the buttons follow the cards, LinkedIn first @mobile", async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, "dan");
    await page.goto("/me/credential");
    await expect(linkedInButton(page)).toBeVisible();
    const [b, a, l, c] = await Promise.all(
      [badge(page), applied(page), linkedInButton(page), copyButton(page)].map(
        (x) => x.boundingBox(),
      ),
    );
    expect(a!.y).toBeGreaterThan(b!.y);
    expect(l!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
    expect(c!.y).toBeGreaterThan(l!.y);
    for (const box of [l!, c!]) {
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThan(300);
    }
    await expectAxeClean(page);
    await page.screenshot({
      path: "output/screens/M4-390.png",
      fullPage: true,
    });
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`15 and the public credential are axe clean, ${scheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1040 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(publicPath());
      await expect(applied(page)).toBeVisible();
      await expectAxeClean(page);
      await page.screenshot({
        path: `output/screens/credential-public-${scheme}.png`,
        fullPage: true,
      });
      await signInAs(page, "dan");
      await page.goto("/me/credential");
      await expect(copyButton(page)).toBeVisible();
      await expectAxeClean(page);
      await page.screenshot({
        path: `output/screens/15-${scheme}.png`,
        fullPage: true,
      });
    });
  }
});

test("week 4: the badge without a reflection points to show and tell", async ({
  page,
}) => {
  // The badge came on 24 September; dan.reflection links it at 3:45 PM on the 30th.
  resetDemo("week4");
  await signInAs(page, "dan");
  await page.goto("/me/credential");
  await expect(badge(page)).toContainText("Completed 24 September 2026");
  await expect(applied(page).getByRole("term")).toHaveText(["Skills shown"]);
  await expect(
    applied(page).getByRole("link", { name: "Open show and tell" }),
  ).toHaveAttribute("href", "/me/show-and-tell");
  await expect(
    page.getByText("Applied reflection = I used it.", { exact: true }),
  ).toHaveCount(0);

  await page.context().clearCookies();
  await page.goto(publicPath());
  await expect(badge(page)).toBeVisible();
  await expect(applied(page).getByRole("term")).toHaveText(["Skills shown"]);
  await expect(
    page.getByRole("link", { name: "Open show and tell" }),
  ).toHaveCount(0);
});

test("without a badge, 15 says when it appears", async ({ page }) => {
  resetDemo("week3");
  await signInAs(page, "dan");
  await page.goto("/me/credential");
  await expect(page.getByText(NO_BADGE, { exact: true })).toBeVisible();
  await expect(copyButton(page)).toHaveCount(0);
  await expect(badge(page)).toHaveCount(0);
  // No badge yet, so no credential link resolves.
  expect(
    (await page.request.get("/credential/dan-okafor-ai-fundamentals")).status(),
  ).toBe(404);
});
