import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const main = (page: Page) => page.getByRole("main");
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const LEAD =
  "Calder Lane, Client Services team. Changes apply to everyone in the workspace.";

async function open(page: Page) {
  await signInAs(page, "priya");
  await page.goto("/workspace/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Workspace settings" }),
  ).toBeVisible();
}

test.describe("18", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("Priya opens 18 from the org menu, on General", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await nav(page).getByRole("button", { name: "Calder Lane" }).click();
    await page.getByRole("menuitem", { name: "Workspace settings" }).click();
    await expect(page).toHaveURL("/workspace/settings");
    await expect(main(page).getByText(LEAD, { exact: true })).toBeVisible();
    await expect(
      main(page).getByText("Owner: Priya Raman", { exact: true }),
    ).toBeVisible();
    // Task 9 adds Sprint defaults and Data and privacy.
    await expect(page.getByRole("tab")).toHaveText(["General"]);
    await expect(
      page.getByRole("tab", { name: "General", selected: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Workspace name")).toHaveValue("Calder Lane");
    await expect(page.getByLabel("Team name")).toHaveValue(
      "Client Services team",
    );
    const partner = page.getByLabel("Partner program");
    await expect(partner).toHaveValue(
      "Southbank Business Collective, delivered with IBM SkillsBuild",
    );
    await expect(partner).not.toBeEditable();
    await expect(
      main(page).getByText("Set by your partner. Contact them to change it."),
    ).toBeVisible();
    await expect(page.getByLabel("Workspace ID")).toHaveValue("calder-lane");
    await expect(page.getByLabel("Workspace ID")).not.toBeEditable();
    await expect(
      main(page).getByRole("link", { name: "Cancel" }),
    ).toHaveAttribute("href", "/home");
  });

  test("General says how to fix a blank name, then saves", async ({ page }) => {
    await open(page);
    const name = page.getByLabel("Workspace name");
    await name.fill(" ");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      main(page).getByText("A workspace needs a name."),
    ).toBeVisible();
    await expect(name).toBeFocused();

    await name.fill("Calder Lane Studio");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Changes saved.", { exact: true }),
    ).toBeVisible();
    // The shell reads the workspace live.
    await expect(
      nav(page).getByRole("button", { name: /Calder Lane Studio/ }),
    ).toBeVisible();
  });

  test("Dan is sent from 18 to his home with a note", async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto("/workspace/settings");
    await expect(page).toHaveURL("/me");
    await expect(
      page.getByText("That page is for your team. You're back on your home."),
    ).toBeVisible();
  });
});
