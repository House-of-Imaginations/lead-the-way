import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { E2E_DOMAIN, convex, resetDemo, signInAs } from "./demo";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const header = (page: Page) => page.getByRole("banner");

/** A real account on e2e.test, so `seed:reset` clears it (Ruling 34). */
async function signUp(page: Page) {
  const email = `e2e-new-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
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

test.describe("Create workspace", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("Create workspace makes a workspace and opens its team setup (R-e)", async ({
    page,
  }) => {
    await realAccount(page);
    // Cancel goes back to the shell's home: /me for an employee (Ruling 29).
    await page.goto("/workspace/new");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL("/me");
    await page.goto("/home");
    await nav(page).getByRole("button", { name: "Calder Lane" }).click();
    await page.getByRole("menuitem", { name: "Create workspace" }).click();
    await expect(page).toHaveURL("/workspace/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create a workspace" }),
    ).toBeVisible();
    await expect(header(page)).toContainText("Create a workspace");
    // Blank names say how to fix them.
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(
      page.getByText("Enter a name for the workspace.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Enter a name for your team.", { exact: true }),
    ).toBeVisible();
    // A name that can't be a web address is refused under its field.
    await page.getByLabel("Workspace name").fill("New");
    await page.getByLabel("Team name").fill("Studio team");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByLabel("Workspace name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByText(
        "That name cannot be used as a web address. Try another.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    // The reset cleared every e2e workspace, so this slug is free.
    await page.getByLabel("Workspace name").fill("Kai Studio");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL("/setup/team");
    await expect(header(page)).toContainText("Set up your team sprint");
    await expect(
      page.getByText("Concept prototype. Not an official IBM product."),
    ).toBeVisible();
    // Landed in the new workspace, with its team name.
    await page.goto("/workspace/settings");
    await expect(page.getByLabel("Workspace ID")).toHaveValue("kai-studio");
    await expect(page.getByLabel("Team name")).toHaveValue("Studio team");
    // The switch items, then Create workspace, then Workspace settings (Ruling 28).
    await nav(page).getByRole("button", { name: "Kai Studio" }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Switch to Calder Lane",
      "Create workspace",
      "Workspace settings",
    ]);
    await page.keyboard.press("Escape");

    // A taken name gets a suffix, never a refusal (M-h).
    await page.goto("/workspace/new");
    await page.getByLabel("Workspace name").fill("Kai Studio");
    await page.getByLabel("Team name").fill("Second team");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL("/setup/team");
    await page.goto("/workspace/settings");
    await expect(page.getByLabel("Workspace ID")).toHaveValue("kai-studio-2");
    await expect(page.getByLabel("Team name")).toHaveValue("Second team");
  });

  test("a demo persona is never offered Create workspace (M-h)", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await nav(page).getByRole("button", { name: "Calder Lane" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Workspace settings", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Create workspace" }),
    ).toHaveCount(0);
    await page.goto("/workspace/new");
    await expect(page).toHaveURL("/manager");
  });

  test("an account with no workspace is sent to make its first one", async ({
    page,
  }) => {
    await signUp(page);
    await page.goto("/workspace/new");
    await expect(page).toHaveURL("/setup/start");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`/workspace/new is axe clean, ${scheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1040 });
      await page.emulateMedia({ colorScheme: scheme });
      await realAccount(page);
      await page.goto("/workspace/new");
      await expect(
        page.getByRole("heading", { level: 1, name: "Create a workspace" }),
      ).toBeVisible();
      await expectAxeClean(page);
      await page.screenshot({
        path: `output/screens/workspace-new-${scheme}.png`,
        fullPage: true,
      });
    });
  }

  test("/workspace/new fits a phone @mobile", async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await realAccount(page);
    await page.goto("/workspace/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create a workspace" }),
    ).toBeVisible();
    await expectAxeClean(page);
    const create = await page
      .getByRole("button", { name: "Create workspace" })
      .boundingBox();
    expect(create!.height).toBeGreaterThanOrEqual(48);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "output/screens/workspace-new-phone.png" });
  });
});
