import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const REASON = "What would make this easier? (optional)";
const BODY =
  "Protected time is the core assumption behind From hero to zero. You can keep exploring, but the team sprint should not launch until learning time is agreed.";
const STALE =
  "You switched workspace in another tab. Reload the page to continue.";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const days = (page: Page) =>
  page.getByRole("group", { name: "Weekly learning day" });
const day = (page: Page, name: string) =>
  days(page).getByRole("button", { name });
const startTime = (page: Page) =>
  page.getByRole("combobox", { name: "Start time" });
const commitment = (page: Page) =>
  page.getByRole("checkbox", { name: /^I will protect this hour/ });
const protect = (page: Page) =>
  page.getByRole("button", { name: "Protect this learning hour" });
const preview = (page: Page) =>
  page.getByRole("region", { name: "Calendar preview" });
const notReady = (page: Page) =>
  page.getByRole("button", { name: "I'm not ready to commit" });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "The sprint depends on this hour" });

/** 03 saved as its PNG has it, which lands on 04. */
async function saveTeam(page: Page) {
  await page.goto("/setup/team");
  await page
    .getByRole("group", { name: "Team size" })
    .getByRole("button", { name: "6 to 10" })
    .click();
  await page
    .getByRole("combobox", { name: "Main team function" })
    .selectOption("Client service");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/setup/team?page=2");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/setup/protected-hour");
}

async function openCalendarMenu(page: Page) {
  await preview(page).getByRole("button", { name: "Add to calendar" }).click();
}

/** Counts submit events on the form: Enter must cause none, and so no save. */
const countSubmits = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { submits: number };
    w.submits = 0;
    document
      .getElementById("setup-form")!
      .addEventListener("submit", () => w.submits++);
  });
const submits = (page: Page) =>
  page.evaluate(() => (window as unknown as { submits: number }).submits);

/** Uncaught errors, which would raise the Next dev overlay. */
function uncaught(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
/**
 * The Next dev overlay's error dialog stays shut. Its issues badge still
 * counts one: Convex's client logs every refused mutation with console.error,
 * even one the form catches.
 */
async function expectNoDevOverlay(page: Page) {
  await expect(page.locator("[data-nextjs-dialog]")).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  resetDemo("setup");
  await signInAs(page, "priya");
});

test("Protect this learning hour stays disabled until the commitment is ticked", async ({
  page,
}) => {
  await page.goto("/setup/protected-hour");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Make learning part of the working week",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The sprint works only if learning does not have to compete with leftover personal time.",
    ),
  ).toBeVisible();
  // The demo's setup clock is Tuesday 1 September, so week one is 7 to 11 September.
  await expect(days(page).getByRole("button")).toHaveText([
    "Mon 7 Sep",
    "Tue 8 Sep",
    "Wed 9 Sep",
    "Thu 10 Sep",
    "Fri 11 Sep",
  ]);
  await expect(day(page, "Wed 9 Sep")).toHaveAttribute("aria-pressed", "true");
  await expect(startTime(page).locator("option")).toHaveText([
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
  ]);
  await expect(startTime(page)).toHaveValue("14:00");
  const duration = page.getByRole("textbox", { name: "Duration" });
  await expect(duration).toHaveValue("1 hour");
  await expect(duration).toBeDisabled();
  await expect(
    page.getByText(
      "Your team can change individual timing if operational needs require flexibility.",
    ),
  ).toBeVisible();
  await expect(
    preview(page).getByText("Added to your team's calendars when you launch"),
  ).toBeVisible();
  // No size band saved yet, so no team total (Ruling 18).
  await expect(
    preview(page).getByText("paid time a week, team total"),
  ).toHaveCount(0);

  await expect(protect(page)).toBeDisabled();
  await expect(protect(page)).toHaveAccessibleDescription(
    "Tick the commitment to continue.",
  );
  await commitment(page).check();
  await expect(protect(page)).toBeEnabled();
  await expect(page.getByText("Tick the commitment to continue.")).toHaveCount(
    0,
  );
});

test("choosing Thursday moves the calendar preview", async ({ page }) => {
  await page.goto("/setup/protected-hour");
  const heading = preview(page).getByRole("heading", { level: 2 });
  await expect(heading).toHaveText("Wednesdays, 2:00 PM to 3:00 PM");
  const blocks = preview(page).getByText("Learn 2 PM", { exact: true });
  await expect(blocks).toHaveCount(4);
  await expect(blocks.first().locator("..")).toContainText("9 Sep");

  await day(page, "Thu 10 Sep").click();
  await expect(day(page, "Thu 10 Sep")).toHaveAttribute("aria-pressed", "true");
  await expect(heading).toHaveText("Thursdays, 2:00 PM to 3:00 PM");
  await expect(blocks).toHaveCount(4);
  await expect(blocks.first().locator("..")).toContainText("10 Sep");
  await expect(blocks.nth(3).locator("..")).toContainText("1 Oct");

  await startTime(page).selectOption({ label: "9:00 AM" });
  await expect(heading).toHaveText("Thursdays, 9:00 AM to 10:00 AM");
  await expect(
    preview(page).getByText("Learn 9 AM", { exact: true }),
  ).toHaveCount(4);
});

test("commit goes to /manager/learning and the checklist marks it done", async ({
  page,
}) => {
  await page.goto("/setup/protected-hour");
  await day(page, "Thu 10 Sep").click();
  await startTime(page).selectOption({ label: "10:00 AM" });
  await commitment(page).check();
  await protect(page).click();
  // 05 is Task 11's. Before it lands this URL is a 404, so the checklist is read on /manager.
  await expect(page).toHaveURL("/manager/learning");
  await page.goto("/manager");
  await expect(
    nav(page).getByRole("link", { name: "Done: Protected hour" }),
  ).toBeVisible();
  await page.goto("/setup/protected-hour");
  await expect(day(page, "Thu 10 Sep")).toHaveAttribute("aria-pressed", "true");
  await expect(startTime(page)).toHaveValue("10:00");
  await expect(commitment(page)).toBeChecked();
});

test("Keep exploring records not ready and opens /manager/learning", async ({
  page,
}) => {
  // Commit first, so clearing the commitment shows.
  await page.goto("/setup/protected-hour");
  await commitment(page).check();
  await protect(page).click();
  await expect(page).toHaveURL("/manager/learning");

  await page.goto("/setup/protected-hour");
  await expect(commitment(page)).toBeChecked();
  await notReady(page).click();
  const more = dialog(page).getByRole("textbox", { name: "Tell us more" });
  await expect(more).toHaveCount(0);
  await dialog(page)
    .getByRole("combobox", { name: REASON })
    .selectOption("Something else");
  await more.fill("We run a client audit in September.");
  await dialog(page).getByRole("button", { name: "Keep exploring" }).click();
  await expect(page).toHaveURL("/manager/learning");

  // Not ready clears the commitment (Ruling 20).
  await page.goto("/manager");
  await expect(
    nav(page).getByRole("link", { name: "Protected hour", exact: true }),
  ).toBeVisible();
  await page.goto("/setup/protected-hour");
  await expect(commitment(page)).not.toBeChecked();
});

test("a double click on Keep exploring records not ready once", async ({
  page,
}) => {
  // Each call is one Mutation frame on the Convex socket.
  const calls: string[] = [];
  page.on("websocket", (ws) =>
    ws.on("framesent", ({ payload }) => {
      if (String(payload).includes('"sprints:notReady"'))
        calls.push(String(payload));
    }),
  );
  await page.goto("/setup/protected-hour");
  await notReady(page).click();
  await dialog(page).getByRole("button", { name: "Keep exploring" }).dblclick();
  await expect(page).toHaveURL("/manager/learning");
  expect(calls).toHaveLength(1);
});

test("Back to scheduling closes the dialog", async ({ page }) => {
  await page.goto("/setup/protected-hour");
  await notReady(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(
    dialog(page).getByText("Protected time", { exact: true }),
  ).toBeVisible();
  await expect(dialog(page).getByText(BODY)).toBeVisible();
  const reason = dialog(page).getByRole("combobox", { name: REASON });
  await expect(reason).toBeFocused();
  await expect(reason.locator("option")).toHaveText([
    "Choose a reason",
    "I need approval from my own manager",
    "Our workload is too high right now",
    "A shorter weekly session would work better",
    "Something else",
  ]);
  await reason.selectOption("Our workload is too high right now");
  await expect(
    dialog(page).getByRole("textbox", { name: "Tell us more" }),
  ).toHaveCount(0);
  await dialog(page)
    .getByRole("button", { name: "Back to scheduling" })
    .click();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL("/setup/protected-hour");
  await expect(notReady(page)).toBeFocused();
});

test("Download .ics saves four weekly events", async ({ page }) => {
  await page.goto("/setup/protected-hour");
  await openCalendarMenu(page);
  const saved = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download .ics" }).click();
  const file = await saved;
  expect(file.suggestedFilename()).toBe("lead-the-way-protected-hour.ics");
  const ics = readFileSync(await file.path(), "utf8");
  expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  expect([...ics.matchAll(/DTSTART:(\w+)/g)].map((m) => m[1])).toEqual([
    "20260909T040000Z",
    "20260916T040000Z",
    "20260923T040000Z",
    "20260930T040000Z",
  ]);
});

test("Open in Google Calendar opens a prefilled recurring event", async ({
  page,
  context,
}) => {
  // No network in e2e: answer Google's address locally.
  await context.route("https://calendar.google.com/**", (route) =>
    route.fulfill({ contentType: "text/plain", body: "ok" }),
  );
  await page.goto("/setup/protected-hour");
  await openCalendarMenu(page);
  const opened = context.waitForEvent("page");
  await page.getByRole("menuitem", { name: "Open in Google Calendar" }).click();
  const tab = await opened;
  await tab.waitForLoadState();
  const url = new URL(tab.url());
  expect(url.origin + url.pathname).toBe(
    "https://calendar.google.com/calendar/render",
  );
  expect(Object.fromEntries(url.searchParams)).toEqual({
    action: "TEMPLATE",
    text: "Protected learning hour",
    dates: "20260909T040000Z/20260909T050000Z",
    recur: "RRULE:FREQ=WEEKLY;COUNT=4",
    ctz: "Australia/Melbourne",
  });
  expect(await tab.evaluate(() => window.opener)).toBeNull();
});

// Task 7 could only check the header button on /setup/team.
test("Save and exit saves a draft and goes to /manager", async ({ page }) => {
  await page.goto("/setup/protected-hour");
  await day(page, "Fri 11 Sep").click();
  await startTime(page).selectOption({ label: "11:00 AM" });
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Save and exit" })
    .click();
  await expect(page).toHaveURL("/manager");
  // A draft: the hour is saved but not committed.
  await expect(
    nav(page).getByRole("link", { name: "Protected hour", exact: true }),
  ).toBeVisible();
  await page.goto("/setup/protected-hour");
  await page.reload();
  await expect(day(page, "Fri 11 Sep")).toHaveAttribute("aria-pressed", "true");
  await expect(startTime(page)).toHaveValue("11:00");
  await expect(commitment(page)).not.toBeChecked();
});

test("Enter never triggers Save and exit", async ({ page }) => {
  await page.goto("/setup/protected-hour");
  await countSubmits(page);
  await commitment(page).press("Enter");
  expect(await submits(page)).toBe(0);
  await commitment(page).check();
  await commitment(page).press("Enter");
  expect(await submits(page)).toBe(0);
  await startTime(page).press("Enter");
  expect(await submits(page)).toBe(0);
  await expect(page).toHaveURL("/setup/protected-hour");
  await expect(commitment(page)).toBeChecked();
});

test("a stale workspace refuses the commit, with no dev overlay", async ({
  page,
}) => {
  const errors = uncaught(page);
  await page.goto("/setup/protected-hour");
  await commitment(page).check();
  // A reset writes Calder Lane again under a new id: expectOrgId is stale.
  resetDemo("setup");
  await protect(page).click();
  await expect(page.getByRole("alert").filter({ hasText: STALE })).toHaveText(
    STALE,
  );
  await expect(page).toHaveURL("/setup/protected-hour");
  expect(errors).toEqual([]);
  await expectNoDevOverlay(page);
});

test("a stale workspace refuses Keep exploring, with no dev overlay", async ({
  page,
}) => {
  const errors = uncaught(page);
  await page.goto("/setup/protected-hour");
  await notReady(page).click();
  resetDemo("setup");
  await dialog(page).getByRole("button", { name: "Keep exploring" }).click();
  // The dialog stays open with the reason, so nothing is lost.
  await expect(dialog(page).getByRole("alert")).toHaveText(STALE);
  await expect(page).toHaveURL("/setup/protected-hour");
  expect(errors).toEqual([]);
  await expectNoDevOverlay(page);
});

test("the preview stacks under the form below 900px", async ({ page }) => {
  await page.setViewportSize({ width: 899, height: 900 });
  await page.goto("/setup/protected-hour");
  const form = await commitment(page).boundingBox();
  const box = await preview(page).boundingBox();
  expect(box!.y).toBeGreaterThan(form!.y + form!.height);
});

for (const scheme of ["light", "dark"] as const) {
  test(`protected hour passes axe with and without the dialog, ${scheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await saveTeam(page);
    await expect(
      page
        .getByRole("list", { name: "Sprint setup" })
        .getByRole("listitem")
        .first(),
    ).toHaveText(/Your team\s*6 to 10 people, client service/);
    await expect(
      preview(page).getByText("8 hrs", { exact: true }),
    ).toBeVisible();
    await expect(
      preview(page).getByText("paid time a week, team total"),
    ).toBeVisible();
    await expectAxeClean(page);
    // For the wireframe review. output/ is git-ignored.
    await page.screenshot({ path: `output/screens/04-${scheme}.png` });

    await notReady(page).click();
    await dialog(page)
      .getByRole("combobox", { name: REASON })
      .selectOption("Something else");
    await expect(
      dialog(page).getByRole("textbox", { name: "Tell us more" }),
    ).toBeVisible();
    await expectAxeClean(page);
    await page.screenshot({ path: `output/screens/04-dialog-${scheme}.png` });
  });
}

test("at 390px the page fits and the footer stacks", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/setup/protected-hour");
  await expect(protect(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Each word of "Learn 2 PM" fits its narrow cell.
  const block = preview(page).getByText("Learn 2 PM", { exact: true }).first();
  expect(await block.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: "output/screens/04-390-light.png",
    fullPage: true,
  });
});
