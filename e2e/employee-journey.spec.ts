import { expect, test } from "./fixtures";
import { convex, resetDemo, signInAs } from "./demo";

const TITLE = "AI-assisted weekly client reporting";
const PUBLIC = "http://localhost:3000/credential/dan-okafor-ai-fundamentals";
const CHECKS = [
  "I reviewed the output before using it in work.",
  "I did not include restricted client or personal information.",
];
const QUESTIONS = [
  "How confident do you feel using AI at work?",
  "I feel comfortable telling my manager how I use AI at work.",
];
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

/** Move the demo clock forward without a reseed: Dan's own rows stay. */
const clock = (target: "week4" | "complete") =>
  convex(["run", "seed:clock", JSON.stringify({ target })]);

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
// The journey leaves the clock at complete; hand the next spec a fresh week 1.
test.afterAll(() => resetDemo("week1"));

test("Dan's sprint, from week 2 to his public credential", async ({
  page,
  browser,
  context,
}) => {
  // Two clock jumps and a reseed, each a Convex CLI run.
  test.setTimeout(240_000);
  resetDemo("week2");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000",
  });
  await signInAs(page, "dan");

  // Week 2: this week, then the next session.
  await page.goto("/me");
  await expect(
    page.getByRole("heading", { level: 1, name: "Good afternoon, Dan" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue learning" }).click();
  await expect(page.getByText("Session 2 marked done.", { exact: true })).toBeVisible();

  // His draft becomes a saved project. The script leaves a project Dan has
  // touched alone, so he fills in the after and the headline himself.
  await page.goto("/me/project");
  await expect(page.getByLabel("Project title")).toHaveValue(TITLE);
  await page
    .getByLabel("What changed?")
    .fill("Reports take about 1 hour 20 minutes, with the same checks.");
  await page.getByLabel("Headline result").fill("40 minutes saved per week");
  for (const label of CHECKS) await page.getByLabel(label).check();
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(
    page.getByRole("button", { name: "Save reflection" }),
  ).toBeVisible();

  // Week 4: present, then the after check-in. The script answers it at
  // 3:30 PM for anyone without rows, so it is answered here, not at complete.
  clock("week4");
  await page.goto("/me/show-and-tell");
  await expect(
    page.getByRole("main").getByText("Week 4", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Present to team" }).click();
  await page
    .getByRole("dialog", { name: "Present to your team?" })
    .getByRole("button", { name: "Present project" })
    .click();
  await expect(
    page.getByText("Presented to your team.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "In this session" }).getByRole("listitem"),
  ).toHaveText([new RegExp(`^${TITLE}\\s*Dan$`)]);

  await expect(
    page.getByText("How did the sprint go?", { exact: true }),
  ).toBeVisible();
  for (const legend of QUESTIONS) {
    await page
      .getByRole("group", { name: legend })
      .getByRole("radio", { name: "4", exact: true })
      .check();
  }
  await page.getByRole("button", { name: "Save answers" }).click();
  await expect(
    page.getByText("How did the sprint go?", { exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Add to badge" }).click();
  await expect(page).toHaveURL("/me/credential");
  await expect(
    page.getByRole("region", { name: "Applied at work" }),
  ).toContainText(TITLE);

  // Complete: the script leaves his choices alone, and the link works signed out.
  clock("complete");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Applied at work" }),
  ).toContainText("Shared at show and tell, 30 Sep");
  await page.getByRole("button", { name: "Copy credential link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    PUBLIC,
  );
  const stranger = await browser.newPage();
  await stranger.goto(PUBLIC);
  await expect(
    stranger.getByText("Shared by Dan Okafor", { exact: true }),
  ).toBeVisible();
  await expect(
    stranger.getByRole("region", { name: "Applied at work" }),
  ).toContainText(TITLE);
  await stranger.close();

  // Priya: team totals, never a name beside a number.
  await context.clearCookies();
  await signInAs(page, "priya");
  await page.goto("/manager");
  await expect(
    page.getByRole("heading", { level: 1, name: "Good afternoon, Priya" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Team progress", exact: true }),
  ).toBeVisible();
  const text = await page.getByRole("main").innerText();
  for (const name of NAMES) expect(text, name).not.toContain(name);
});
