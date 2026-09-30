import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { THEMES, gallery } from "./helpers";

const nav = (page: Page) =>
  page.locator("#sidenav").getByRole("navigation", { name: "Main" });
const handle = (page: Page) =>
  page
    .locator("#sidenav")
    .getByRole("separator", { name: "Resize navigation" });

async function drag(page: Page, dx: number) {
  // page.mouse doesn't scroll, and the gallery puts the side nav below the fold.
  await handle(page).scrollIntoViewIfNeeded();
  const box = (await handle(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 5 });
  await page.mouse.up();
}

test.describe("side nav", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(gallery("light"));
  });

  test("renders the shell in order with the current page marked", async ({
    page,
  }) => {
    const n = nav(page);
    await expect(n).toHaveCSS("width", "256px");
    await expect(n.getByRole("link", { name: "Lead the Way" })).toBeVisible();
    await expect(n.getByText("Calder Lane")).toBeVisible();
    await expect(n.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(n.getByText("Week 2 of 4")).toBeVisible();
    await expect(
      n.getByRole("button", { name: "Priya Raman", exact: true }),
    ).toBeVisible();
    await expect(
      n.getByRole("button", { name: "Calder Lane", exact: true }),
    ).toBeVisible();
    await expect(
      n.getByText("Concept prototype. Not an official IBM product."),
    ).toBeVisible();
  });

  test("arrow keys resize by 16px within 200 to 400", async ({ page }) => {
    await handle(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect(handle(page)).toHaveAttribute("aria-valuenow", "272");
    await expect(nav(page)).toHaveCSS("width", "272px");
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight");
    await expect(handle(page)).toHaveAttribute("aria-valuenow", "400");
    for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft");
    await expect(handle(page)).toHaveAttribute("aria-valuenow", "200");
  });

  test("Enter, Space, double-click and the Collapse row toggle the rail", async ({
    page,
  }) => {
    await handle(page).focus();
    await page.keyboard.press("Enter");
    await expect(nav(page)).toHaveCSS("width", "48px");
    await page.keyboard.press("Space");
    await expect(nav(page)).toHaveCSS("width", "256px");
    await handle(page).dblclick();
    await expect(nav(page)).toHaveCSS("width", "48px");
    await nav(page).getByRole("button", { name: "Expand navigation" }).click();
    await expect(nav(page)).toHaveCSS("width", "256px");
    await nav(page).getByRole("button", { name: "Collapse" }).click();
    await expect(nav(page)).toHaveCSS("width", "48px");
  });

  test("dragging resizes and snaps to the rail below 140px", async ({
    page,
  }) => {
    await drag(page, 60);
    await expect(handle(page)).toHaveAttribute("aria-valuenow", "316");
    await drag(page, 400);
    await expect(handle(page)).toHaveAttribute("aria-valuenow", "400");
    await drag(page, -300);
    await expect(nav(page)).toHaveClass(/\bltw-sn-col\b/);
    await expect(nav(page)).toHaveCSS("width", "48px");
  });

  test("only the primary button drags", async ({ page }) => {
    await handle(page).scrollIntoViewIfNeeded();
    const box = (await handle(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(x + 60, y, { steps: 5 });
    await page.mouse.up({ button: "right" });
    await page.keyboard.press("Escape"); // the context menu, if any
    await expect(handle(page)).toHaveAttribute("aria-valuenow", "256");
    await expect(nav(page)).toHaveCSS("width", "256px");
  });

  test("the resize handle is the last Tab stop", async ({ page }) => {
    await nav(page).getByRole("button", { name: "Priya Raman" }).focus();
    await page.keyboard.press("Tab");
    await expect(handle(page)).toBeFocused();
  });

  test("the column scrolls when the screen is short", async ({ page }) => {
    await nav(page).evaluate((el) => {
      el.parentElement!.style.height = "300px";
    });
    // Rows keep their 32px height instead of squashing to fit.
    await expect(nav(page).getByRole("link", { name: "Overview" })).toHaveCSS(
      "height",
      "32px",
    );
    const disclaimer = nav(page).getByText(
      "Concept prototype. Not an official IBM product.",
    );
    await disclaimer.scrollIntoViewIfNeeded();
    const n = (await nav(page).boundingBox())!;
    const d = (await disclaimer.boundingBox())!;
    expect(d.y + d.height).toBeLessThanOrEqual(n.y + n.height);
    // The handle still spans the whole column.
    expect((await handle(page).boundingBox())!.height).toBeCloseTo(n.height, 0);
  });

  test("rail hides every label", async ({ page }) => {
    await nav(page).getByRole("button", { name: "Collapse" }).click();
    await expect(nav(page)).toHaveCSS("width", "48px");
    // Only the two avatars' initials may show. Links keep their names through title.
    const text = await nav(page).evaluate((el) =>
      (el as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
    );
    expect(text).toBe("CL PR");
    // Named by the person and the organisation, not by their initials.
    await expect(
      nav(page).getByRole("button", { name: "Priya Raman", exact: true }),
    ).toBeVisible();
    await expect(
      nav(page).getByRole("button", { name: "Calder Lane", exact: true }),
    ).toBeVisible();
    await expect(
      nav(page).getByRole("link", { name: "Overview" }),
    ).toBeVisible();
    await expect(
      nav(page).getByRole("link", { name: "Lead the Way" }),
    ).toBeVisible();
  });

  test("width and rail survive a reload", async ({ page }) => {
    await handle(page).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.reload();
    await expect(handle(page)).toHaveAttribute("aria-valuenow", "288");
    await handle(page).focus();
    await page.keyboard.press("Enter");
    await page.reload();
    await expect(nav(page)).toHaveCSS("width", "48px");
  });

  test("a saved rail hydrates without errors", async ({ page, context }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await context.addCookies([
      { name: "ltw-sidenav", value: "c300", url: "http://localhost:3000" },
    ]);
    await page.reload();
    await expect(nav(page)).toHaveCSS("width", "48px");
    await nav(page).getByRole("button", { name: "Expand navigation" }).click();
    await expect(nav(page)).toHaveCSS("width", "300px");
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
  });

  test("the choice is saved in a cookie the server can read", async ({
    page,
    context,
  }) => {
    await handle(page).focus();
    await page.keyboard.press("ArrowRight");
    const cookie = (await context.cookies()).find(
      (c) => c.name === "ltw-sidenav",
    );
    expect(cookie?.value).toBe("w272");
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("below 1056px with nothing saved, the first paint is already the rail", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    // With scripts off, only the server HTML and CSS decide the width.
    await page.route("**/*.js", (route) => route.abort());
    await page.reload();
    await expect(nav(page)).toHaveCSS("width", "48px");
    await expect(nav(page).getByText("Calder Lane")).toBeHidden();
    await page.unroute("**/*.js");
    await page.reload();
    await expect(nav(page)).toHaveCSS("width", "48px");
    await nav(page).getByRole("button", { name: "Expand navigation" }).click();
    await expect(nav(page)).toHaveCSS("width", "256px");
  });

  test("the checklist marks done, current and todo steps", async ({ page }) => {
    const list = nav(page).getByRole("list");
    await expect(list.getByRole("link")).toHaveText([
      "Done: Protected hour",
      "Manager pathway",
      "Team agreement",
      "Invite team",
    ]);
    await expect(
      list.getByRole("link", { name: "Manager pathway" }),
    ).toHaveAttribute("aria-current", "step");
    await expect(
      list.getByRole("link", { name: "Team agreement" }),
    ).not.toHaveAttribute("aria-current");
    await expect(nav(page).getByText("Sprint setup")).toBeVisible();
  });

  test("the status block reads the week, the hour and its progress", async ({
    page,
  }) => {
    const bar = nav(page).getByRole("progressbar", { name: "Sprint progress" });
    await expect(bar).toHaveAttribute("aria-valuenow", "2");
    await expect(bar).toHaveAttribute("aria-valuemax", "4");
    await expect(nav(page).getByText("Week 2 of 4")).toBeVisible();
    await expect(nav(page).getByText("Next protected hour")).toBeVisible();
    await expect(nav(page).getByText("Wed 16 Sep, 2:00 PM")).toBeVisible();
  });

  test("the account menu opens upward and the org block switches", async ({
    page,
  }) => {
    const account = nav(page).getByRole("button", { name: /Priya Raman/ });
    // Read the trigger first: the open menu is modal and hides the page from the accessibility tree.
    const accountBox = (await account.boundingBox())!;
    await account.click();
    const menu = page.getByRole("menu");
    // Radix positions the menu a frame after it mounts, so poll the geometry.
    await expect
      .poll(async () => {
        const m = await menu.boundingBox();
        return m ? m.y + m.height : Infinity;
      })
      .toBeLessThanOrEqual(accountBox.y);
    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByText("Last account action: Sign out")).toBeVisible();
    await nav(page)
      .getByRole("button", { name: /Calder Lane/ })
      .click();
    await expect(
      page
        .getByRole("menu")
        .getByRole("menuitem", { name: "Create workspace" }),
    ).toBeVisible();
  });
});

for (const theme of THEMES) {
  test(`side nav passes axe expanded and in the rail, ${theme}`, async ({
    page,
    context,
    expectAxeClean,
  }) => {
    await context.clearCookies();
    await page.goto(gallery(theme));
    await expectAxeClean(page, "#sidenav");
    await nav(page).getByRole("button", { name: "Collapse" }).click();
    await expect(nav(page)).toHaveCSS("width", "48px");
    await expectAxeClean(page, "#sidenav");
  });
}
