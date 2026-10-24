import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { PERSONA, demoPassword, resetDemo, type Persona } from "./demo";

/** Everyone in Calder Lane but Priya, and Priya's surname: none may appear on 08 or 16. */
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
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

/** The real log-in form, typed. */
async function logIn(page: Page, who: Persona) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(PERSONA[who]);
  await page.getByLabel("Password", { exact: true }).fill(demoPassword());
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/** The account menu's sign-out, which ends on log in. */
async function logOut(page: Page, name: string) {
  await nav(page).getByRole("button", { name }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** The floating demo clock: pick a target, then wait for the full reload. */
async function moveClock(page: Page, item: RegExp, shows: string) {
  const clock = page.getByRole("region", { name: "Demo clock" });
  await clock.getByRole("button", { name: "Move clock" }).click();
  await page.getByRole("menuitem", { name: item }).click();
  await expect(
    page.getByRole("region", { name: "Demo clock" }).getByText(shows),
  ).toBeVisible();
}

/** No cast name anywhere in the main column. */
async function expectNoNames(page: Page) {
  const text = await main(page).innerText();
  for (const name of NAMES) expect(text, name).not.toContain(name);
}

// The trace would record the typed demo password.
test.use({ trace: "off" });
test.describe.configure({ mode: "serial" });

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));
test.afterAll(() => resetDemo());

test("Priya, then Dan, then Priya through the demo clock", async ({ page }) => {
  // Two reseeds, two clock moves and five log-ins.
  test.setTimeout(300_000);
  resetDemo();

  // 1. Priya before launch lands on her setup path.
  await logIn(page, "priya");
  await expect(page).toHaveURL(/\/setup\//);

  // 2. The clock to week 1 launches the sprint.
  await moveClock(page, /^Week 1/, "Wed 9 Sep, 1:00 PM");
  await page.goto("/manager");
  await expect(
    page.getByRole("region", { name: "Team sprint", exact: true }),
  ).toContainText("Week 1 of 4");

  // 3. Out through the account menu.
  await logOut(page, "Priya Raman");

  // 4. Dan at week 1 signs the agreement and starts his project.
  await logIn(page, "dan");
  await expect(page).toHaveURL("/me");
  await expect(main(page)).toContainText("Week 1");
  await page.goto("/me/agreement");
  const signatures = page.getByRole("complementary", { name: "Signatures" });
  await signatures.getByRole("button", { name: "Sign the agreement" }).click();
  await expect(
    page.getByText("Agreement signed", { exact: true }),
  ).toBeVisible();
  await page.goto("/me/project");
  await page
    .getByRole("textbox", { name: "Project title", exact: true })
    .fill("Weekly client report");
  await expect(page.getByText("Draft saved at 1:00 PM")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Project title", exact: true }),
  ).toHaveValue("Weekly client report");
  await logOut(page, "Dan Okafor");

  // 5. Priya closes the sprint; both manager pages stay aggregate only.
  await logIn(page, "priya");
  await expect(page).toHaveURL("/manager");
  await moveClock(page, /^Sprint complete$/, "Thu 1 Oct, 4:00 PM");
  await expect(
    page.getByRole("region", { name: "Team sprint", exact: true }),
  ).toContainText("Sprint complete");
  // 08 counts read "N of M" (or "Hidden" below the threshold).
  const bars = page
    .getByRole("list", { name: "Team progress", exact: true })
    .getByRole("progressbar");
  await expect(bars).not.toHaveCount(0);
  for (const bar of await bars.all())
    await expect(bar).toHaveAttribute("aria-valuetext", /^\d+ of \d+$|Hidden/);
  await expectNoNames(page);
  await page.goto("/manager/outcomes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sprint complete" }),
  ).toBeVisible();
  // 16 draws team totals as a bare number (or "Hidden"), as its PNG does.
  const tiles = page
    .getByRole("list", { name: "Team participation", exact: true })
    .getByRole("listitem");
  await expect(tiles).toHaveCount(3);
  for (const tile of await tiles.all())
    await expect(tile).toHaveText(/\d+$|Hidden/);
  await expectNoNames(page);

  // 6. Out and in again: still the closed sprint.
  await logOut(page, "Priya Raman");
  await logIn(page, "priya");
  await expect(page).toHaveURL("/manager");
  await expect(
    page.getByRole("region", { name: "Team sprint", exact: true }),
  ).toContainText("Sprint complete");

  // 7. Reset. The demo's reset control lives only on /guide (P14b's), so the
  // spec resets through the CLI, then signs out and back in.
  resetDemo();
  await page.goto("/signed-out");
  await expect(page).toHaveURL(/\/login/);
  await logIn(page, "priya");
  await expect(page).toHaveURL(/\/setup\//);
});
