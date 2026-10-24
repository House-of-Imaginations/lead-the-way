import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { E2E_DOMAIN, convex, resetDemo, signInAs } from "./demo";

const LAST_OWNER =
  "You're the only owner. Make somebody else an owner in Workspace settings, or delete the workspace.";

/** A real account on e2e.test, so `seed:reset` clears it (Ruling 34). */
async function signUp(page: Page) {
  const email = `e2e-leave-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
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

test.describe("Leave workspace", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("demo people don't see Leave workspace (R6)", async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto("/me/settings");
    await page.getByRole("tab", { name: "Profile" }).click();
    await expect(page.getByLabel("Full name")).toHaveValue("Dan Okafor");
    await expect(
      page.getByRole("heading", { name: "Leave workspace" }),
    ).toHaveCount(0);
  });

  test("the sole owner sees why they can't leave (R5)", async ({ page }) => {
    await realAccount(page);
    await page.goto("/workspace/new");
    await page.getByLabel("Workspace name").fill("Kai solo workspace");
    await page.getByLabel("Team name").fill("Solo team");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL("/setup/team");

    await page.goto("/settings");
    await expect(
      page.getByRole("tab", { name: "Profile", selected: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Leave workspace" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Leave workspace" }),
    ).toBeDisabled();
    await expect(page.getByText(LAST_OWNER, { exact: true })).toBeVisible();
  });

  test("a real member leaves and lands on /start (R4, R7) @mobile", async ({
    page,
    expectAxeClean,
  }) => {
    await realAccount(page);
    await page.goto("/me/settings");
    await page.getByRole("tab", { name: "Profile" }).click();
    const open = page.getByRole("button", { name: "Leave workspace" });
    const dialog = page.getByRole("dialog");
    // Escape and Cancel give focus back to the button that opened it (M3).
    await open.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();

    await open.click();
    await expect(
      dialog.getByRole("heading", { name: "Leave Calder Lane?" }),
    ).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      "You lose your seat and settings here. A credential link you shared keeps working.",
    );
    await expectAxeClean(page, '[role="dialog"]');
    await dialog.getByRole("button", { name: "Leave workspace" }).click();
    // No seat left: /home sends them to choose a track.
    await expect(page).toHaveURL("/start");
  });
});
