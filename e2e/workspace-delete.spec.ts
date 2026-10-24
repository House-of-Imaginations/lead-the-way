import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { E2E_DOMAIN, convex, resetDemo, signInAs } from "./demo";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

/** A real account on e2e.test, so `seed:reset` clears it (Ruling 34). */
async function signUp(page: Page) {
  const email = `e2e-delete-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Kai Moreno", email, password: "a long enough password" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
  return email;
}

/** A real (non-demo) account seated in Calder Lane as an employee. */
async function realAccount(page: Page) {
  const email = await signUp(page);
  const token = JSON.parse(
    convex(["run", "seed:invite", JSON.stringify({ email })]),
  ) as string;
  await page.goto(`/join/${token}`);
  await page.getByRole("button", { name: "Join team sprint" }).click();
  // The before check-in is still open at week 2.
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL("/me");
}

test.describe("Delete workspace", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("only the owner sees Delete workspace, never in the demo (R2)", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.goto("/workspace/settings");
    await expect(
      page.getByRole("tab", { name: "General", selected: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Workspace ID")).toHaveValue("calder-lane");
    await expect(
      page.getByRole("heading", { name: "Delete workspace" }),
    ).toHaveCount(0);
  });

  test("Delete workspace needs the exact name, then lands on the next seat (R1, R3, R7)", async ({
    page,
    expectAxeClean,
  }) => {
    await realAccount(page);
    await page.goto("/workspace/new");
    await page.getByLabel("Workspace name").fill("Kai test workspace");
    await page.getByLabel("Team name").fill("Test team");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL("/setup/team");

    // A second tab on the same workspace (M1): it lands on /home's answer too.
    const other = await page.context().newPage();
    for (const p of [page, other]) {
      await p.goto("/workspace/settings");
      await expect(
        p.getByRole("heading", { name: "Delete workspace" }),
      ).toBeVisible();
    }
    await page.bringToFront();
    await page.getByRole("button", { name: "Delete workspace" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Delete Kai test workspace?" }),
    ).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Delete workspace" });
    const field = dialog.getByLabel("Type Kai test workspace to confirm");
    await expect(confirm).toBeDisabled();
    // A case difference keeps it disabled; stray spaces don't.
    await field.fill("kai test workspace");
    await expect(confirm).toBeDisabled();
    await field.fill("  Kai test workspace ");
    await expect(confirm).toBeEnabled();
    await expectAxeClean(page, '[role="dialog"]');
    await confirm.click();

    // The Calder Lane seat is next: an employee's home, in both tabs, and
    // nobody switched anything (R8).
    for (const p of [page, other]) {
      await expect(p).toHaveURL("/me", { timeout: 10_000 });
      await expect(p.getByText(/switched workspace/)).toHaveCount(0);
    }
    await nav(page).getByRole("button", { name: "Calder Lane" }).click();
    await expect(page.getByRole("menuitem").first()).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: /Kai test workspace/ }),
    ).toHaveCount(0);
  });
});
