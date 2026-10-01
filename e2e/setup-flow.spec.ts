import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const REQUIRED = [
  "Why your team needs shared AI norms",
  "Supporting AI learning without micromanaging",
  "Creating your Team AI Agreement",
];

test("Priya sets up and launches the sprint", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  resetDemo();
  await signInAs(page, "priya");
  const nav = page.getByRole("navigation", { name: "Main" });

  await page.goto("/home");
  await expect(page).toHaveURL("/setup/team");

  // 03, page 1
  await page
    .getByRole("group", { name: "Team size" })
    .getByRole("button", { name: "6 to 10" })
    .click();
  await page
    .getByRole("combobox", { name: "Industry" })
    .selectOption("Professional services");
  await page
    .getByRole("combobox", { name: "Main team function" })
    .selectOption("Client service");
  await page
    .getByRole("radio", { name: "Advanced users, inconsistent practices" })
    .check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL("/setup/team?page=2");

  // 03, page 2
  await page.getByRole("checkbox", { name: "Lack of time to learn" }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // 04
  await expect(page).toHaveURL("/setup/protected-hour");
  await page
    .getByRole("checkbox", { name: /^I will protect this hour/ })
    .check();
  await page
    .getByRole("button", { name: "Protect this learning hour" })
    .click();

  // 05
  await expect(page).toHaveURL("/manager/learning");
  for (const title of REQUIRED) {
    await page.getByRole("button", { name: title }).click();
    await page.getByRole("button", { name: "Mark as complete" }).click();
    await expect(
      page.getByRole("button", { name: title }).getByText("Completed"),
    ).toBeVisible();
  }
  await page.getByRole("radio", { name: "4", exact: true }).check();
  await page.getByRole("button", { name: "Continue to agreement" }).click();

  // 06
  await expect(page).toHaveURL("/manager/agreement");
  await page.getByRole("button", { name: "Save agreement" }).click();
  await expect(
    page.getByText("Version 1. Your team signs it when they join.", {
      exact: true,
    }),
  ).toBeVisible();

  // 07, through the nav
  await nav.getByRole("link", { name: "Sprint", exact: true }).click();
  await expect(page).toHaveURL("/manager/sprint/launch");
  const send = page.getByRole("button", { name: "Send invitations" });
  await expect(send).toBeEnabled();

  // Enter in "Add by email" adds an address; it never launches the sprint.
  const field = page.getByRole("textbox", { name: "Add by email" });
  await field.fill("dan.okafor@calderlane.com.au");
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect(send).toBeEnabled();
  // A launch would survive a reload; the form coming back proves none ran.
  await page.reload();
  await expect(send).toBeEnabled();
  await expect(
    page.getByRole("list", { name: "Invite your team" }),
  ).toBeVisible();
  await expect(nav.getByText("Sprint setup")).toBeVisible();

  // An emptied list gives its own reason once setup is done.
  const remove = page.getByRole("button", { name: /^Remove / });
  for (let i = 0; i < 8; i++) await remove.first().click();
  await expect(remove).toHaveCount(0);
  await expect(send).toBeDisabled();
  await expect(send).toHaveAccessibleDescription(
    "Add at least one email address.",
  );
  await page.reload();
  await expect(send).toBeEnabled();

  // Watch for the launched-elsewhere notice for the whole launch, since a
  // flash between the query flipping and the mutation resolving is brief.
  await page.evaluate(() => {
    const w = window as unknown as { sawLaunched: boolean };
    w.sawLaunched = false;
    new MutationObserver(() => {
      if (
        document.body.textContent?.includes("Your sprint has already launched.")
      )
        w.sawLaunched = true;
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  await send.click();
  await expect(
    page.getByText("Sprint launched", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("8 invitations ready. Copy each link below.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Copy link for / }),
  ).toHaveCount(8);
  await expect(
    page.getByRole("heading", { name: "Invitations", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as unknown as { sawLaunched: boolean }).sawLaunched,
    ),
  ).toBe(false);
  await expect(nav.getByText("Sprint setup")).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Sprint", exact: true }),
  ).toHaveAttribute("href", "/manager");
  await page.screenshot({
    path: "output/screens/07-launched.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
