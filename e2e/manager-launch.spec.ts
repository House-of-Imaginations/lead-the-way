import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { convex, resetDemo, signInAs } from "./demo";

const CAST = [
  "dan.okafor",
  "sarah.whitlock",
  "mei.tanaka",
  "tomas.reyes",
  "aisha.karimi",
  "luca.bianchi",
  "grace.oyelaran",
  "omar.haddad",
].map((name) => `${name}@calderlane.com.au`);
const GATE =
  "Protect the hour, finish the pathway and save the agreement first.";
const LAUNCHED = "Your sprint has already launched.";
const BAD_EMAIL = "Enter an email address like name@example.com.";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const sendButton = (page: Page) =>
  page.getByRole("button", { name: "Send invitations" });
const inviteList = (page: Page) =>
  page.getByRole("list", { name: "Invite your team" });
const emailField = (page: Page) =>
  page.getByRole("textbox", { name: "Add by email" });

/** Uncaught errors, which would raise the Next dev overlay. */
function uncaught(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function open(page: Page) {
  await signInAs(page, "priya");
  await page.goto("/manager/sprint/launch");
}

test("Send invitations is disabled with the reason until setup is done", async ({
  page,
}) => {
  resetDemo();
  await open(page);
  await expect(sendButton(page)).toBeDisabled();
  await expect(sendButton(page)).toHaveAccessibleDescription(GATE);
  await expect(page.getByText(GATE, { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Joining is voluntary and never used as a performance score.",
    ),
  ).toBeVisible();
});

test("the demo list starts with the eight teammates", async ({ page }) => {
  resetDemo();
  await open(page);
  await expect(inviteList(page).getByRole("listitem")).toHaveText(CAST);
  await expect(page.getByText("8 people", { exact: true })).toBeVisible();

  const message = page.getByRole("textbox", { name: "Message from you" });
  await expect(message).toHaveValue(/^Hi team, from Wednesday 9 September/);
  await expect(message).toHaveAccessibleDescription(
    "Shown at the top of the invitation.",
  );

  await inviteList(page)
    .getByRole("button", { name: `Remove ${CAST[0]}` })
    .click();
  await expect(inviteList(page).getByRole("listitem")).toHaveCount(7);
  await expect(page.getByText("7 people", { exact: true })).toBeVisible();

  const summary = page.getByRole("region", { name: "Sprint summary" });
  await expect(summary).toContainText("Wednesdays, 2:00 PM to 3:00 PM");
  await expect(summary).toContainText("AI Productivity Fundamentals");
  await expect(summary).toContainText("Apply one idea to real work");
  await expect(
    summary.getByRole("link", { name: "Team AI Agreement" }),
  ).toHaveAttribute("href", "/manager/agreement");
  await expect(
    page.getByRole("link", { name: "Preview invitation" }),
  ).toHaveAttribute("href", "/join/preview");
});

test("an emptied list says to add the team by email", async ({ page }) => {
  resetDemo();
  await open(page);
  for (const email of CAST)
    await inviteList(page)
      .getByRole("button", { name: `Remove ${email}` })
      .click();
  await expect(page.getByText("0 people", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Add your team by email.", { exact: true }),
  ).toBeVisible();
});

test("Add by email rejects a malformed address", async ({ page }) => {
  resetDemo();
  await open(page);
  const field = emailField(page);

  await field.fill("not-an-email");
  await field.press("Enter");
  await expect(field).toHaveAccessibleDescription(BAD_EMAIL);
  await expect(page.getByText("8 people", { exact: true })).toBeVisible();

  // Punctuation the server refuses, which would turn one address into two.
  await field.fill("a@example.com,b@example.com");
  await field.press("Enter");
  await expect(field).toHaveAccessibleDescription(BAD_EMAIL);
  await expect(page.getByText("8 people", { exact: true })).toBeVisible();

  await field.fill("  New.Person@Example.com ");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(inviteList(page).getByRole("listitem").last()).toHaveText(
    "new.person@example.com",
  );
  await expect(page.getByText("9 people", { exact: true })).toBeVisible();
  await expect(field).toHaveValue("");
  await expect(field).not.toHaveAccessibleDescription(/Enter an email/);

  // A duplicate in another case, or with the trailing dot the server drops,
  // is skipped quietly.
  await field.fill("DAN.OKAFOR@calderlane.com.au.");
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect(page.getByText("9 people", { exact: true })).toBeVisible();
});

test("Add by email stops at 50 addresses", async ({ page }) => {
  resetDemo();
  await open(page);
  const field = emailField(page);
  for (let i = 0; i < 42; i++) {
    await field.fill(`person${i}@example.com`);
    await field.press("Enter");
  }
  await expect(page.getByText("50 people", { exact: true })).toBeVisible();
  await field.fill("one.more@example.com");
  await field.press("Enter");
  await expect(field).toHaveAccessibleDescription(
    "You can invite up to 50 people at once. Remove one to add another.",
  );
  await expect(page.getByText("50 people", { exact: true })).toBeVisible();
});

test("the checklist disappears after launch and Sprint links to /manager", async ({
  page,
  context,
  expectAxeClean,
}) => {
  const errors = uncaught(page);
  resetDemo("week1");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000",
  });
  await open(page);
  await expect(nav(page).getByText("Sprint setup")).toHaveCount(0);
  await expect(
    nav(page).getByRole("link", { name: "Sprint", exact: true }),
  ).toHaveAttribute("href", "/manager");
  await expect(page.getByText(LAUNCHED, { exact: true })).toBeVisible();
  await expect(sendButton(page)).toHaveCount(0);
  const invitations = page.getByRole("list", { name: "Invitations" });
  await expect(invitations).toContainText("Joined");
  // Sarah has joined by week1, so she has no link to copy.
  await expect(
    page.getByRole("button", { name: `Copy link for ${CAST[1]}` }),
  ).toHaveCount(0);

  await page
    // Omar is the only invitation still pending at week1 (Task 5 pins it).
    .getByRole("button", { name: `Copy link for ${CAST[7]}` })
    .click();
  await expect(page.getByText("Link copied", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^http:\/\/localhost:3000\/join\/\S+$/,
  );
  await expectAxeClean(page);
  await page.screenshot({
    path: "output/screens/07-launched-elsewhere.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("a second launch shows the launched message", async ({ page }) => {
  const errors = uncaught(page);
  resetDemo();
  await open(page);
  await expect(sendButton(page)).toBeVisible();
  // The tester jumps the clock in another tab; this tab must not launch again.
  convex(["run", "seed:clock", JSON.stringify({ target: "week1" })]);
  await expect(page.getByText(LAUNCHED, { exact: true })).toBeVisible();
  await expect(sendButton(page)).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Invitations" }).getByRole("listitem"),
  ).toHaveCount(8);
  expect(errors).toEqual([]);
});

for (const scheme of ["light", "dark"] as const) {
  test(`07 is axe clean, ${scheme}`, async ({ page, expectAxeClean }) => {
    resetDemo();
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Launch your 4-week sprint",
      }),
    ).toBeVisible();
    await expect(inviteList(page).getByRole("listitem")).toHaveCount(8);
    await expectAxeClean(page);
    await page.screenshot({
      path: `output/screens/07-${scheme}.png`,
      fullPage: true,
    });
  });
}

test("07 stacks to one column at 390", async ({ page, expectAxeClean }) => {
  resetDemo();
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(inviteList(page).getByRole("listitem")).toHaveCount(8);
  const form = page.getByRole("heading", { name: "Invite your team" });
  const summary = page.getByRole("region", { name: "Sprint summary" });
  const formBox = await form.boundingBox();
  const summaryBox = await summary.boundingBox();
  expect(summaryBox!.y).toBeGreaterThan(formBox!.y);
  expect(summaryBox!.x).toBeCloseTo(formBox!.x, 0);
  // Nothing scrolls sideways inside the shell's scrolling main.
  const main = page.getByRole("main");
  expect(await main.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expectAxeClean(page);
  await page.screenshot({ path: "output/screens/07-390.png", fullPage: true });
});
