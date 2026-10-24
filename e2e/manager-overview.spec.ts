import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const EMPTY = "Your team's totals appear here after you launch the sprint.";
/** Everyone in Calder Lane but Priya, and Priya's surname: none may appear on 08. */
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

const main = (page: Page) => page.getByRole("main");
const region = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });
const timeline = (page: Page) =>
  page.getByRole("list", { name: "Your four-week AI sprint" });
const columns = (page: Page) => timeline(page).locator(":scope > li");
const currentColumn = (page: Page) =>
  timeline(page).locator(':scope > li[aria-current="step"]');
const totals = (page: Page) =>
  page.getByRole("list", { name: "Team progress", exact: true });
const tile = (page: Page, label: string) =>
  totals(page).getByRole("listitem").filter({ hasText: label });

const resources = (page: Page) => region(page, "Resources");
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const SIMULATED = "Simulated in this prototype.";
const WHY = "Why can't I see individual progress?";
const WHY_TEXT =
  "From zero to hero shows you team totals only. Individual course activity, time spent and scores stay private to each person, so learning feels safe. Projects appear only when their owner chooses to present them.";

async function open(page: Page) {
  await signInAs(page, "priya");
  await page.goto("/manager");
}

async function expectShown(page: Page, label: string, count: string) {
  await expect(tile(page, label)).toContainText(count);
  await expect(
    tile(page, label).getByRole("progressbar", { name: label }),
  ).toHaveAttribute("aria-valuetext", count);
}

async function expectPending(page: Page, label: string) {
  await expect(tile(page, label)).toContainText("Not yet");
  await expect(tile(page, label)).toContainText(
    "Updated after Wed 9 Sep, 3:00 PM",
  );
  await expect(tile(page, label).getByRole("progressbar")).toHaveCount(0);
}

// Uncaught errors, which would raise the Next dev overlay.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test.describe("week 2", () => {
  test.beforeAll(() => resetDemo("week2"));

  test("08 reads as the wireframe, with team totals only", async ({ page }) => {
    await open(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Good afternoon, Priya" }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        "Your team is in week 2. The next protected hour is Wednesday 16 September at 2:00 PM.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Preview team view" }),
    ).toHaveAttribute("href", "/join/preview");
    await expect(
      page.getByRole("link", { name: "Invite member" }),
    ).toHaveAttribute("href", "/manager/sprint/launch");
    await expect(
      main(page).getByText(
        "Aggregate progress only. Individual course activity remains private.",
        { exact: true },
      ),
    ).toBeVisible();

    await expect(columns(page)).toHaveCount(5);
    await expect(columns(page).locator(":scope > p")).toHaveText([
      "Setup, 1 to 8 Sep",
      "Week 1, 9 Sep",
      "Week 2, 16 Sep (current)",
      "Week 3, 23 Sep",
      "Week 4, 30 Sep",
    ]);
    await expect(currentColumn(page)).toHaveCount(1);
    await expect(currentColumn(page)).toContainText("Week 2, 16 Sep (current)");
    await expect(columns(page).nth(0).getByRole("listitem")).toHaveText([
      "Done: Manager pathway",
      "Done: Team AI Agreement",
      "Done: Invite team",
    ]);
    await expect(columns(page).nth(4).getByRole("listitem")).toHaveText([
      "Show and tell",
    ]);

    const learning = region(page, "Your learning");
    await expect(learning).toContainText("Leading AI at Work");
    await expect(learning).toContainText("65%");
    await expect(
      learning.getByRole("progressbar", { name: "Sprint coaching modules" }),
    ).toHaveAttribute("aria-valuenow", "65");
    await expect(
      learning.getByRole("link", { name: "Continue pathway" }),
    ).toHaveAttribute("href", "/manager/learning");

    const sprint = region(page, "Team sprint");
    await expect(sprint).toContainText("Week 2 of 4");
    await expect(sprint).toContainText("Active");
    await expect(sprint.getByRole("term")).toHaveText([
      "Invited",
      "Joined",
      "Projects",
    ]);
    await expect(sprint.getByRole("definition").nth(0)).toHaveText("8");
    await expect(sprint.getByRole("definition").nth(1)).toHaveText("7");
    await expect(
      sprint.getByRole("link", { name: "View sprint" }),
    ).toHaveAttribute("href", "/manager/sprint/launch");

    const agreement = region(page, "Team AI Agreement");
    await expect(agreement).toContainText("Signed by the team");
    await expect(agreement).toContainText("Completed");
    await expect(agreement).toContainText(
      "Last updated 7 September 2026. You'll review it together at the week 4 show and tell.",
    );
    await expect(
      agreement.getByRole("link", { name: "Review agreement" }),
    ).toHaveAttribute("href", "/manager/agreement");

    await expect(region(page, "Team progress")).toContainText(
      "Team totals, updated weekly",
    );
    await expect(totals(page).getByRole("listitem")).toHaveCount(3);
    await expectShown(page, "Joined the sprint", "7 of 8");
    await expectShown(page, "Week 1 session done", "6 of 7");
    await expectShown(page, "Real tasks underway", "5 of 7");
    await expect(main(page).getByText(EMPTY)).toHaveCount(0);

    // Never a name beside a number: the only name is Priya's, in her greeting.
    const text = await main(page).innerText();
    for (const name of NAMES) expect(text, name).not.toContain(name);
  });

  test("Resources lists the four and confirms with a toast", async ({
    page,
  }) => {
    await open(page);
    const rows = resources(page).getByRole("listitem");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("Inclusive facilitation guide");
    await expect(rows.nth(0)).toContainText(
      "For part-time, CALD and neurodivergent staff",
    );
    await expect(rows.nth(1)).toContainText(
      "Approved tools, de-identified data, human review",
    );
    await expect(rows.nth(2)).toContainText("A 30-minute format for week 4");
    await expect(rows.nth(3)).toContainText(
      "With an IBM volunteer, through Month of Impact",
    );
    await expect(resources(page).getByRole("button")).toHaveText([
      "Open Inclusive facilitation guide",
      "Open Responsible AI checklist",
      "Open Show and tell run sheet",
      "Book 15-minute mentor call",
    ]);

    await resources(page)
      .getByRole("button", { name: "Open Responsible AI checklist" })
      .click();
    await expect(page.getByText(SIMULATED, { exact: true })).toBeVisible();
    await expect(page).toHaveURL("/manager");

    // A fresh load, so the first toast is gone.
    await page.reload();
    await resources(page)
      .getByRole("button", { name: "Book 15-minute mentor call" })
      .click();
    await expect(page.getByText(SIMULATED, { exact: true })).toBeVisible();
  });

  test("/manager#resources focuses the resources", async ({ page }) => {
    await signInAs(page, "priya");
    // A full load with the hash.
    await page.goto("/manager#resources");
    await expect(resources(page)).toBeFocused();

    // The nav link from the overview itself: a hash-only navigation.
    await page.goto("/manager");
    await expect(resources(page)).not.toBeFocused();
    await nav(page).getByRole("link", { name: "Resources" }).click();
    await expect(page).toHaveURL("/manager#resources");
    await expect(resources(page)).toBeFocused();

    // And from another page.
    await page.goto("/manager/learning");
    await nav(page).getByRole("link", { name: "Resources" }).click();
    await expect(page).toHaveURL("/manager#resources");
    await expect(resources(page)).toBeFocused();
  });

  test("the disclosure says why there are no individual numbers", async ({
    page,
    expectAxeClean,
  }) => {
    await open(page);
    await expect(page.getByText(WHY_TEXT, { exact: true })).toBeHidden();
    await page.getByText(WHY, { exact: true }).click();
    await expect(page.getByText(WHY_TEXT, { exact: true })).toBeVisible();
    await expectAxeClean(page);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`08 is axe clean, ${scheme}`, async ({ page, expectAxeClean }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await expect(tile(page, "Week 1 session done")).toBeVisible();
      await expectAxeClean(page);
      // output/ is git-ignored: the scratch copy Step 7 compares with the PNG.
      await page.screenshot({
        path: `output/screens/08-${scheme}.png`,
        fullPage: true,
      });
    });
  }
});

test("week 1 shows the activity totals as not yet", async ({ page }) => {
  resetDemo("week1");
  await open(page);
  await expect(
    main(page).getByText(
      "Your team is in week 1. The next protected hour is Wednesday 9 September at 2:00 PM.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(region(page, "Team sprint")).toContainText("Week 1 of 4");
  await expect(currentColumn(page)).toContainText("Week 1, 9 Sep (current)");
  await expectPending(page, "Week 1 session done");
  await expectPending(page, "Real tasks underway");
});

test("before launch the totals wait for the sprint", async ({ page }) => {
  resetDemo();
  await signInAs(page, "priya");
  // The tester saves the team first (the demo prefills 02), as the wording table assumes.
  await page.goto("/setup/team");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/setup/team?page=2");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/setup/protected-hour");

  await page.goto("/manager");
  await expect(
    main(page).getByText(
      "Your sprint starts Wednesday 9 September at 2:00 PM.",
      { exact: true },
    ),
  ).toBeVisible();
  const sprint = region(page, "Team sprint");
  await expect(sprint).toContainText("Starts 9 Sep");
  await expect(sprint).toContainText("Draft");
  await expect(region(page, "Team AI Agreement")).toContainText(
    "Not saved yet",
  );
  await expect(main(page).getByText(EMPTY, { exact: true })).toBeVisible();
  await expect(totals(page)).toHaveCount(0);
});

test("a finished sprint shows the week 4 totals", async ({ page }) => {
  resetDemo("complete");
  await open(page);
  await expect(
    main(page).getByText("Your sprint finished on Wednesday 30 September.", {
      exact: true,
    }),
  ).toBeVisible();
  const sprint = region(page, "Team sprint");
  await expect(sprint).toContainText("Sprint complete");
  await expect(sprint).toContainText("Completed");
  await expect(currentColumn(page)).toHaveCount(0);
  await expectShown(page, "Week 4 session done", "7 of 7");
  await expectShown(page, "Real tasks underway", "6 of 7");
});

test("a closed sprint offers Run another sprint in Invite member's place (R-d)", async ({
  page,
}) => {
  resetDemo("complete");
  await open(page);
  await expect(page.getByRole("link", { name: "Invite member" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Preview team view" }),
  ).toBeVisible();
  const run = page.getByRole("button", { name: "Run another sprint" });
  expect((await run.boundingBox())!.height).toBe(48);
  await page.screenshot({ path: "output/screens/08-run-another.png" });
  await run.click();
  await expect(page).toHaveURL("/setup/protected-hour");
  resetDemo();
});

test("Run another sprint fits a phone on 08 @mobile", async ({ page }) => {
  resetDemo("complete");
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const run = await page
    .getByRole("button", { name: "Run another sprint" })
    .boundingBox();
  expect(run!.height).toBeGreaterThanOrEqual(48);
  expect(run!.width).toBeGreaterThan(300);
  resetDemo();
});
