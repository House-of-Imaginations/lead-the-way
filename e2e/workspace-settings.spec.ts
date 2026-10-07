import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { convex, resetDemo, signInAs } from "./demo";

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

const members = (page: Page) => page.getByRole("region", { name: "Members" });
const heading = (page: Page, n: number) =>
  main(page).getByRole("heading", {
    level: 2,
    name: `${n} people in this workspace`,
  });
const manage = (page: Page, name: string) =>
  page.getByRole("button", { name: `Manage ${name}` });

test.describe("18", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("Priya opens 18 from the org menu, on General", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await nav(page).getByRole("button", { name: "Calder Lane" }).click();
    await page
      .getByRole("menuitem", { name: "Workspace settings", exact: true })
      .click();
    await expect(page).toHaveURL("/workspace/settings");
    await expect(main(page).getByText(LEAD, { exact: true })).toBeVisible();
    await expect(
      main(page).getByText("Owner: Priya Raman", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveText([
      "General",
      "Members",
      "Sprint defaults",
      "Data and privacy",
      "Roles",
    ]);
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
      main(page).getByText("Set by your partner. Contact them to change it.", {
        exact: true,
      }),
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
      main(page).getByText("A workspace needs a name.", { exact: true }),
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

  test("Sprint defaults show the hour new sprints start from, and save", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("tab", { name: "Sprint defaults" }).click();
    const day = page.getByRole("group", { name: "Default learning day" });
    await expect(day.getByRole("button")).toHaveText([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ]);
    // No defaults saved: Calder Lane's sprint, Wednesday 2:00 PM in Melbourne.
    await expect(day.getByRole("button", { name: "Wed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByLabel("Default start time")).toHaveValue("14:00");
    await expect(page.getByLabel("Time zone")).toHaveValue(
      "Australia/Melbourne",
    );
    await expect(page.getByLabel("Sprint length")).toHaveValue("4 weeks");
    await expect(page.getByLabel("Sprint length")).toBeDisabled();
    await expect(
      main(page).getByText("Fixed at four weeks in this prototype.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Course")).toHaveValue(
      "AI Productivity Fundamentals",
    );
    await expect(page.getByLabel("Course")).toBeDisabled();

    await day.getByRole("button", { name: "Thu" }).click();
    await page.getByLabel("Default start time").selectOption("10:00");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Changes saved.", { exact: true }),
    ).toBeVisible();
    // Saved defaults read back; the running sprint keeps its hour (Task 5's test).
    await page.reload();
    await page.getByRole("tab", { name: "Sprint defaults" }).click();
    await expect(
      page
        .getByRole("group", { name: "Default learning day" })
        .getByRole("button", { name: "Thu" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Default start time")).toHaveValue("10:00");
  });

  test("Data and privacy sets the threshold, never below 5", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("tab", { name: "Data and privacy" }).click();
    const threshold = page.getByLabel("Small-group threshold");
    await expect(threshold.locator("option")).toHaveText([
      "5 responses",
      "6 responses",
      "7 responses",
      "8 responses",
      "9 responses",
      "10 responses",
    ]);
    await expect(threshold).toHaveValue("5");
    await expect(
      main(page).getByText(
        "Team totals stay hidden until this many people respond. It can't go below 5.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      main(page).getByRole("complementary", { name: "Managers can see" }),
    ).toBeVisible();
    await expect(
      main(page).getByRole("complementary", { name: "Managers never see" }),
    ).toContainText("Individual survey answers");

    await threshold.selectOption("6");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Changes saved.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Data and privacy" }).click();
    await expect(page.getByLabel("Small-group threshold")).toHaveValue("6");
  });

  test("Members lists everyone once, invites, revokes and removes", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("tab", { name: "Members" }).click();
    // Priya and seven who joined, and Omar still invited (spec: 9).
    await expect(heading(page, 9)).toBeVisible();
    await expect(
      members(page).getByRole("row", { name: /Dan Okafor/ }),
    ).toContainText("Joined");
    await expect(
      members(page).getByRole("row", { name: /Omar Haddad/ }),
    ).toContainText("Invited");
    // Name, email, role and state only (privacy rule 7).
    await expect(members(page).getByRole("columnheader")).toHaveText([
      "Name",
      "Email",
      "Role",
      "Status",
      "Manage",
    ]);
    // Nothing to manage on your own row.
    await expect(manage(page, "Priya Raman")).toHaveCount(0);

    // Invite: a refusal says how to fix it, then a link is made.
    await page.getByRole("button", { name: "Invite member" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite member" });
    // The launch role is picked by default.
    await expect(
      dialog.getByLabel("Role").locator("option:checked"),
    ).toHaveText("Employee");
    await dialog.getByLabel("Email").fill(".");
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect(dialog.getByLabel("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      dialog.getByText("Enter a full email address.", { exact: true }),
    ).toBeVisible();
    // Omar's invitation is still open, so his address is refused (F2).
    await dialog.getByLabel("Email").fill("Omar.Haddad@calderlane.com.au");
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect(dialog.getByLabel("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      dialog.getByText("Already in this workspace.", { exact: true }),
    ).toBeVisible();
    const email = `e2e-member-${Date.now()}@example.com`;
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    // The demo workspace never sends.
    await expect(
      page.getByText("Invitation created.", { exact: true }),
    ).toBeVisible();
    await expect(heading(page, 10)).toBeVisible();

    await manage(page, email).click();
    await page.getByRole("menuitem", { name: "Revoke" }).click();
    await expect(
      page.getByText("Invitation revoked.", { exact: true }),
    ).toBeVisible();
    await expect(heading(page, 9)).toBeVisible();
    // Its row is gone, so focus lands on the heading, not the page (F5).
    await expect(heading(page, 9)).toBeFocused();

    // Change role says what a mid-sprint change does; Cancel leaves it.
    await manage(page, "Dan Okafor").click();
    await page.getByRole("menuitem", { name: "Change role" }).click();
    const role = page.getByRole("dialog", { name: "Change role" });
    await expect(role).toContainText(
      "Changing a role during a sprint can hide the rest of that sprint's team totals.",
    );
    await role.getByRole("button", { name: "Cancel" }).click();
    await expect(role).toHaveCount(0);
    // Back to the row's own Manage button (FLAG 30).
    await expect(manage(page, "Dan Okafor")).toBeFocused();

    // Remove: the page still takes clicks after a dialog from the menu.
    await manage(page, "Grace Oyelaran").click();
    await page.getByRole("menuitem", { name: "Remove member" }).click();
    const remove = page.getByRole("dialog", {
      name: "Remove Grace Oyelaran?",
    });
    await expect(remove).toContainText(
      "Removing someone during a sprint can hide the rest of that sprint's team totals.",
    );
    await remove.getByRole("button", { name: "Remove member" }).click();
    await expect(
      page.getByText("Member removed.", { exact: true }),
    ).toBeVisible();
    await expect(heading(page, 8)).toBeVisible();
    await expect(
      members(page).getByRole("row", { name: /Grace Oyelaran/ }),
    ).toHaveCount(0);
    // The removed row's menu is gone, so focus lands on the header.
    await expect(heading(page, 8)).toBeFocused();
    // And nothing is left blocking the page (pointer-events).
    await manage(page, "Dan Okafor").click();
    await expect(
      page.getByRole("menuitem", { name: "Change role" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "General" }).click();
    await expect(page.getByLabel("Workspace name")).toBeVisible();
  });

  test("Dan is sent from 18 to his home with a note", async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto("/workspace/settings");
    await expect(page).toHaveURL("/me");
    await expect(
      page.getByText("That page is for your team. You're back on your home.", {
        exact: true,
      }),
    ).toBeVisible();
  });
});

test.describe("18 axe and phone", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  for (const scheme of ["light", "dark"] as const) {
    test(`18 is axe clean on every tab, ${scheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1040 });
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      for (const [tab, file] of [
        ["General", "general"],
        ["Members", "members"],
        ["Sprint defaults", "sprint"],
        ["Data and privacy", "privacy"],
        ["Roles", "roles"],
      ] as const) {
        await page.getByRole("tab", { name: tab }).click();
        await expectAxeClean(page);
        await page.screenshot({
          path: `output/screens/18-${file}-${scheme}.png`,
          fullPage: true,
        });
      }
    });
  }

  test("18 fits a phone @mobile", async ({ page, expectAxeClean }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const name = await page.getByLabel("Workspace name").boundingBox();
    const team = await page.getByLabel("Team name").boundingBox();
    expect(team!.y).toBeGreaterThan(name!.y);
    const save = await page
      .getByRole("button", { name: "Save changes" })
      .boundingBox();
    expect(save!.height).toBeGreaterThanOrEqual(48);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const tab of [
      "General",
      "Members",
      "Sprint defaults",
      "Data and privacy",
      "Roles",
    ]) {
      await page.getByRole("tab", { name: tab }).click();
      await expectAxeClean(page);
      // Only the tables scroll sideways, inside their own regions.
      expect(
        await page.evaluate(() => {
          const main = document.querySelector("main")!;
          return main.scrollWidth <= main.clientWidth;
        }),
        tab,
      ).toBe(true);
    }
    await page.getByRole("tab", { name: "Members" }).click();
    const invite = await page
      .getByRole("button", { name: "Invite member" })
      .boundingBox();
    expect(invite!.height).toBeGreaterThanOrEqual(48);
    const manageBtn = await page
      .getByRole("button", { name: /^Manage / })
      .first()
      .boundingBox();
    expect(manageBtn!.height).toBeGreaterThanOrEqual(48);
    await page.getByRole("tab", { name: "Roles" }).click();
    const create = await page
      .getByRole("button", { name: "Create role" })
      .boundingBox();
    expect(create!.height).toBeGreaterThanOrEqual(48);
    await page.screenshot({ path: "output/screens/18-roles-phone.png" });
  });
});

/**
 * A fresh account seated on `seed:invite`'s role for `flag`, at /manager.
 * On e2e.test, so `seed:reset` clears it (Ruling 34).
 */
async function seated(
  page: Page,
  flag: "members" | "roles" | "org",
  name: string,
) {
  const email = `e2e-${flag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
  const token = JSON.parse(
    convex(["run", "seed:invite", JSON.stringify({ email, [flag]: true })]),
  ) as string;
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { name, email, password: "a long enough password" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
  await page.goto(`/join/${token}`);
  await page.getByRole("button", { name: "Join team sprint" }).click();
  // A manager by W-f, without sprint:manage: home is the overview.
  await expect(page).toHaveURL("/manager");
}

test.describe("18 for a members:manage seat", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("complete"));
  test.afterAll(() => resetDemo());

  test("a members:manage seat sees only the Members tab (W-g)", async ({
    page,
  }) => {
    await seated(page, "members", "Noor Aziz");
    await page.goto("/workspace/settings");
    await expect(page).toHaveURL("/workspace/settings");
    await expect(page.getByRole("tab")).toHaveText(["Members"]);
    await expect(
      main(page).getByText("Owner: Priya Raman", { exact: true }),
    ).toBeVisible();
    await expect(
      main(page).getByRole("heading", { level: 2, name: /in this workspace$/ }),
    ).toBeVisible();
  });
});

test.describe("18 for single-permission seats", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("complete"));
  test.afterAll(() => resetDemo());

  test("a roles:manage seat sees only Roles, and can't edit its own role (W-g, R-a)", async ({
    page,
  }) => {
    await seated(page, "roles", "Rhea Patel");
    await page.goto("/workspace/settings");
    await expect(page.getByRole("tab")).toHaveText(["Roles"]);
    await expect(
      page.getByRole("button", { name: "Manage Role admin" }),
    ).toHaveCount(0);
    // Employee is within reach; the owner role never is.
    await expect(
      page.getByRole("button", { name: "Manage Employee" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Manage Manager" }),
    ).toHaveCount(0);
  });

  test("an org:manage seat sees General and the two tabs it opens, Sprint defaults read-only", async ({
    page,
  }) => {
    await seated(page, "org", "Wren Ito");
    await page.goto("/workspace/settings");
    await expect(page.getByRole("tab")).toHaveText([
      "General",
      "Sprint defaults",
      "Data and privacy",
    ]);
    await page.getByRole("tab", { name: "Sprint defaults" }).click();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
    await expect(
      main(page).getByText(
        "Only people who manage sprints can change sprint defaults.",
      ),
    ).toBeVisible();
  });
});

const roles = (page: Page) => page.getByRole("region", { name: "Roles" });
const roleRow = (page: Page, name: string) =>
  roles(page).getByRole("row").filter({ hasText: name });
const ALERT =
  "The 1 person with this role stops being a manager and joins team totals. Changing roles during a sprint can hide the rest of that sprint's team totals.";
const ALERT_UP =
  "The 1 person with this role becomes a manager and leaves team totals. Changing roles during a sprint can hide the rest of that sprint's team totals.";

test.describe("18 Roles", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("Priya creates, edits and deletes roles, and is warned before moving people (R-a, R-b)", async ({
    page,
  }) => {
    await open(page);
    await page.getByRole("tab", { name: "Roles" }).click();
    await expect(
      main(page).getByRole("heading", { level: 2, name: "2 roles" }),
    ).toBeVisible();
    await expect(roleRow(page, "Manager")).toContainText("Every permission");
    await expect(roleRow(page, "Employee")).toContainText("No permissions");
    await expect(roleRow(page, "Employee")).toContainText(
      "Your team joins with this role.",
    );
    // The owner role and Priya's own have no menu (R-a).
    await expect(
      page.getByRole("button", { name: "Manage Manager" }),
    ).toHaveCount(0);

    // The launch role's boxes are all off, with its one reason (R-a).
    const dialog = page.getByRole("dialog");
    await page.getByRole("button", { name: "Manage Employee" }).click();
    await page.getByRole("menuitem", { name: "Edit role" }).click();
    const boxes = dialog.getByRole("checkbox");
    await expect(boxes.first()).toBeVisible();
    for (const box of await boxes.all()) await expect(box).toBeDisabled();
    await expect(
      dialog.getByText(
        "Your team joins with this role, so it has no permissions.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      dialog.getByText("Your role doesn't include this."),
    ).toHaveCount(0);
    await expect(
      dialog.getByText(
        "Adding a permission withdraws pending invitations into this role.",
      ),
    ).toHaveCount(0);
    // Cancel goes back to the row's Manage button.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Manage Employee" }),
    ).toBeFocused();

    // Create role: a name and M-i's words.
    await page.getByRole("button", { name: "Create role" }).click();
    await dialog.getByLabel("Role name").fill("Coordinator");
    await dialog.getByLabel("See team totals").check();
    await expect(dialog.getByLabel("See who is in the workspace")).toHaveCount(
      0,
    );
    await page.screenshot({ path: "output/screens/18-role-modal.png" });
    await dialog.getByRole("button", { name: "Create role" }).click();
    await expect(
      page.getByText("Role created.", { exact: true }),
    ).toBeVisible();
    await expect(roleRow(page, "Coordinator")).toContainText("See team totals");

    // Names are unique, whatever the case.
    await page.getByRole("button", { name: "Create role" }).click();
    await dialog.getByLabel("Role name").fill("coordinator");
    await dialog.getByRole("button", { name: "Create role" }).click();
    await expect(
      dialog.getByText("Another role already has that name.", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    // Dan takes the role, so it has a holder.
    await page.getByRole("tab", { name: "Members" }).click();
    await manage(page, "Dan Okafor").click();
    await page.getByRole("menuitem", { name: "Change role" }).click();
    await dialog.getByLabel("Role").selectOption({ label: "Coordinator" });
    await dialog.getByRole("button", { name: "Change role" }).click();
    await expect(
      page.getByText("Role changed.", { exact: true }),
    ).toBeVisible();
    // The dialog closes onto the row's Manage button.
    await expect(dialog).toHaveCount(0);
    await expect(manage(page, "Dan Okafor")).toBeFocused();

    // Taking team totals away moves Dan back across the line: confirm first.
    await page.getByRole("tab", { name: "Roles" }).click();
    await expect(roleRow(page, "Coordinator")).toContainText("1");
    await page.getByRole("button", { name: "Manage Coordinator" }).click();
    await page.getByRole("menuitem", { name: "Edit role" }).click();
    await dialog.getByLabel("See team totals").uncheck();
    await dialog.getByRole("button", { name: "Save role" }).click();
    await expect(dialog.getByRole("alert")).toContainText(ALERT);
    await dialog.getByRole("button", { name: "Save anyway" }).click();
    await expect(page.getByText("Role saved.", { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(roleRow(page, "Coordinator")).toContainText("No permissions");

    // And giving it back: a change of mind clears the confirm (R-b).
    await page.getByRole("button", { name: "Manage Coordinator" }).click();
    await page.getByRole("menuitem", { name: "Edit role" }).click();
    const totals = dialog.getByLabel("See team totals");
    await totals.check();
    await dialog.getByRole("button", { name: "Save role" }).click();
    await expect(dialog.getByRole("alert")).toContainText(ALERT_UP);
    await expect(
      dialog.getByRole("button", { name: "Save anyway" }),
    ).toBeVisible();
    await totals.uncheck();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Save role" }),
    ).toBeVisible();
    await totals.check();
    await dialog.getByRole("button", { name: "Save role" }).click();
    await dialog.getByRole("button", { name: "Save anyway" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(roleRow(page, "Coordinator")).toContainText("See team totals");

    // A role nobody holds can go.
    await page.getByRole("button", { name: "Create role" }).click();
    await dialog.getByLabel("Role name").fill("Spare");
    await dialog.getByRole("button", { name: "Create role" }).click();
    await expect(roleRow(page, "Spare")).toBeVisible();
    await page.getByRole("button", { name: "Manage Spare" }).click();
    await page.getByRole("menuitem", { name: "Delete role" }).click();
    await dialog.getByRole("button", { name: "Delete role" }).click();
    await expect(
      page.getByText("Role deleted.", { exact: true }),
    ).toBeVisible();
    await expect(roleRow(page, "Spare")).toHaveCount(0);
    await expect(page.locator("#roles-heading")).toBeFocused();
  });
});
