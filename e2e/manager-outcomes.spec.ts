import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

/** Everyone in Calder Lane but Priya, and Priya's surname: none may appear on 16. */
const NAMES = [
  "Raman",
  "Dan",
  "Okafor",
  "Sarah",
  "Whitlock",
  "Mei",
  "Tanaka",
  "Tomás",
  "Reyes",
  "Aisha",
  "Karimi",
  "Luca",
  "Bianchi",
  "Grace",
  "Oyelaran",
  "Omar",
  "Haddad",
];
const LINK = "http://localhost:3000/signup?ref=calder-lane";
const CONFIDENCE = "Confidence using AI at work";
const COMFORT = "Comfort discussing AI with my manager";
const BEFORE = "Before, 8 Sep";
const AFTER = "After, 30 Sep";

const main = (page: Page) => page.getByRole("main");
const region = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
const tile = (page: Page, label: string) =>
  page
    .getByRole("list", { name: "Team participation", exact: true })
    .getByRole("listitem")
    .filter({ hasText: label });
/** One question's Before or After row. */
const bar = (page: Page, question: string, phase: string) =>
  region(page, question).getByRole("listitem").filter({ hasText: phase });
const categories = (page: Page) =>
  page
    .getByRole("list", { name: "Applied projects", exact: true })
    .getByRole("listitem");
const invite = (page: Page) =>
  main(page).getByRole("button", { name: "Invite another team" });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Invite another team" });

async function open(page: Page) {
  await signInAs(page, "priya");
  await page.goto("/manager/outcomes");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("complete", () => {
  test.beforeAll(() => resetDemo("complete"));

  test("16 shows the team's outcomes as totals", async ({ page }) => {
    await open(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sprint complete" }),
    ).toBeVisible();
    await expect(main(page).getByText("Finished 30 Sep", { exact: true })).toBeVisible();
    await expect(
      main(page).getByText(
        "Your team made AI learning part of the working week. Here is what changed, as a team.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(invite(page)).toBeVisible();

    await expect(tile(page, "Invited")).toHaveText(/^Invited\s*8$/);
    await expect(tile(page, "Completed the sprint")).toHaveText(/^Completed the sprint\s*7$/);
    await expect(tile(page, "Applied projects presented")).toHaveText(/^Applied projects presented\s*6$/);

    await expect(region(page, "Before and after")).toContainText(
      "Team average on a 1 to 5 scale, 5 responses before and 7 after",
    );
    await expect(bar(page, CONFIDENCE, BEFORE)).toContainText("2.8");
    await expect(bar(page, CONFIDENCE, AFTER)).toContainText("4.0");
    await expect(bar(page, COMFORT, BEFORE)).toContainText("2.6");
    await expect(bar(page, COMFORT, AFTER)).toContainText("3.9");
    await expect(region(page, COMFORT)).toContainText(
      "“I feel comfortable telling my manager how I use AI at work.”",
    );

    // The demo script's six presented projects (the PNG shows 2, 2, 1, 1).
    await expect(region(page, "Applied projects")).toContainText(
      "6 projects completed",
    );
    await expect(categories(page)).toHaveText([
      /^Reporting and drafting\s*2$/,
      /^Email workflows\s*1$/,
      /^Meeting notes\s*1$/,
      /^Analysis\s*2$/,
    ]);
    await expect(region(page, "Applied projects")).toContainText(
      "Individual course activity remains private.",
    );
    await expect(region(page, "Applied projects")).toContainText(
      "These are team totals. No names, scores, rankings or time spent are shown.",
    );
    await expect(
      page.getByRole("link", {
        name: "Review the Team AI Agreement with your team",
      }),
    ).toHaveAttribute("href", "/manager/agreement");

    const text = await main(page).innerText();
    for (const name of NAMES) expect(text, name).not.toContain(name);
  });

  test("Invite another team shares the sign-up link", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://localhost:3000",
    });
    await open(page);
    await invite(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page)).toContainText("Share");
    await expect(dialog(page)).toContainText(
      "Know another manager? Share Lead the Way.",
    );
    const field = dialog(page).getByLabel("Sign-up link");
    await expect(field).toHaveValue(LINK);
    await expect(field).not.toBeEditable();
    const copy = dialog(page).getByRole("button", { name: "Copy link" });
    await expect(copy).toBeFocused();

    await copy.click();
    await expect(page.getByText("Link copied.", { exact: true })).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LINK);

    // The footer's Close; the X in the header is also named Close.
    await invite(page).click();
    await dialog(page)
      .getByRole("button", { name: "Close", exact: true })
      .last()
      .click();
    await expect(dialog(page)).toBeHidden();
    await expect(invite(page)).toBeFocused();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`16 and its modal are axe clean, ${scheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1040 });
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await expect(region(page, "Applied projects")).toBeVisible();
      await expectAxeClean(page);
      await page.screenshot({
        path: `output/screens/16-${scheme}.png`,
        fullPage: true,
      });
      await invite(page).click();
      await expect(dialog(page)).toBeVisible();
      await expectAxeClean(page);
      await page.screenshot({ path: `output/screens/16-invite-${scheme}.png` });
    });
  }

  test("16 stacks at 390 with no sideways scroll @mobile", async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const charts = await region(page, "Before and after").boundingBox();
    const projects = await region(page, "Applied projects").boundingBox();
    expect(projects!.y).toBeGreaterThan(charts!.y + charts!.height - 1);
    const first = await tile(page, "Invited").boundingBox();
    const second = await tile(page, "Completed the sprint").boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y);
    expect((await invite(page).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expectAxeClean(page);
    await page.screenshot({ path: "output/screens/16-390.png", fullPage: true });
  });
});

test.describe("week 4", () => {
  test.beforeAll(() => resetDemo("week4"));

  test("16 says when the outcomes appear", async ({ page }) => {
    await open(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sprint in progress" }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        "Outcomes appear on Thu 1 Oct, the day after the last protected hour.",
      ),
    ).toBeVisible();
    await expect(invite(page)).toBeVisible();
    await expect(region(page, "Team participation")).toHaveCount(0);
  });
});

test.describe("setup", () => {
  test.beforeAll(() => resetDemo("setup"));

  test("16 waits for the first sprint", async ({ page }) => {
    await open(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Outcomes" }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Outcomes appear after your first sprint."),
    ).toBeVisible();
    await expect(invite(page)).toHaveCount(0);
  });
});

test.describe("run another sprint", () => {
  test.beforeAll(() => resetDemo("complete"));

  test("Priya runs another sprint from 16, and sprint 1 stays on 16 and on Dan's /me", async ({
    page,
  }) => {
    await open(page);
    const run = main(page).getByRole("button", { name: "Run another sprint" });
    await expect(run).toBeVisible();
    await run.click();
    await expect(page).toHaveURL("/setup/protected-hour");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Make learning part of the working week",
      }),
    ).toBeVisible();

    // 16 still shows sprint 1, and the clone takes the button away.
    await page.goto("/manager/outcomes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sprint complete" }),
    ).toBeVisible();
    await expect(
      main(page).getByText("Finished 30 Sep", { exact: true }),
    ).toBeVisible();
    await expect(invite(page)).toBeVisible();
    await expect(
      main(page).getByRole("button", { name: "Run another sprint" }),
    ).toHaveCount(0);

    await page.context().clearCookies();
    await signInAs(page, "dan");
    await page.goto("/me");
    await expect(
      page.getByText("Your sprint finished on Wednesday 30 September."),
    ).toBeVisible();
  });
});
