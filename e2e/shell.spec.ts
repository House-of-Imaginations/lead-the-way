import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { TOKENS } from "./components/helpers";
import { resetDemo, signInAs } from "./demo";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const BANNER =
  "Demo workspace. Calder Lane is sample data for trying From Zero to Hero. It can be reset at any time.";
const EMPTY_OVERVIEW =
  "Your team's totals appear here after you launch the sprint.";
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const banner = (page: Page) =>
  page.getByRole("status").filter({ hasText: "Demo workspace." });

async function openAccount(page: Page, name: string) {
  await nav(page).getByRole("button", { name }).click();
}

test.describe("week 2", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));

  test("Priya's shell reads as 08", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await expect(
      page.getByRole("heading", { level: 1, name: "Good afternoon, Priya" }),
    ).toBeVisible();
    await expect(nav(page).getByRole("link")).toHaveText([
      "From Zero to Hero",
      "Overview",
      "Sprint",
      "Team agreement",
      "Outcomes",
      "My learning",
      "Resources",
    ]);
    await expect(
      nav(page).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav(page).getByRole("link", { name: "Resources" }),
    ).not.toHaveAttribute("aria-current");
    await expect(nav(page).getByText("Week 2 of 4")).toBeVisible();
    await expect(nav(page).getByText("Wed 16 Sep, 2:00 PM")).toBeVisible();
    await expect(
      nav(page).getByRole("progressbar", { name: "Sprint progress" }),
    ).toHaveAttribute("aria-valuenow", "2");
    await expect(nav(page).getByText("Sprint setup")).toHaveCount(0);
    await expect(banner(page)).toHaveText(BANNER);
    // The empty overview is for before launch only (shell.checklist is set).
    await expect(page.getByText(EMPTY_OVERVIEW)).toHaveCount(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the avatar follows the role, ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const cases = [
        ["priya", "/manager", "Priya Raman", TOKENS[scheme].avatarManager],
        ["dan", "/me", "Dan Okafor", TOKENS[scheme].tagGrayBg],
      ] as const;
      for (const [who, path, name, fill] of cases) {
        await page.context().clearCookies();
        await page.setViewportSize({ width: 1280, height: 800 });
        await signInAs(page, who);
        await page.goto(path);
        const avatar = (scope: ReturnType<typeof nav>) =>
          scope.getByRole("button", { name }).locator(".ltw-av");
        await expect(avatar(nav(page)), who).toHaveCSS(
          "background-color",
          fill,
        );
        // The top bar, on a phone.
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(avatar(page.getByRole("banner")), who).toHaveCSS(
          "background-color",
          fill,
        );
      }
    });
  }

  test("Dan's shell reads as 11", async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto("/me");
    await expect(
      page.getByRole("heading", { level: 1, name: "Good afternoon, Dan" }),
    ).toBeVisible();
    await expect(nav(page).getByRole("link")).toHaveText([
      "From Zero to Hero",
      "This week",
      "My sprint",
      "Work project",
      "Show and tell",
      "Credential",
      "Team agreement",
    ]);
    await expect(
      nav(page).getByText("Your learning activity is private."),
    ).toBeVisible();
    await expect(nav(page).getByRole("progressbar")).toHaveCount(0);
    // Dan has one workspace and no workspace settings: the org block is not a menu.
    await expect(
      nav(page).getByRole("button", { name: "Calder Lane" }),
    ).toHaveCount(0);
  });

  test("only main scrolls: the page itself never does", async ({ page }) => {
    // Absolutely placed sr-only text once escaped main's clip and made the
    // whole page scroll, leaving a blank strip under the shell.
    await signInAs(page, "priya");
    await page.setViewportSize({ width: 1440, height: 820 });
    await page.goto("/manager");
    await expect(
      page.getByRole("heading", { name: "Resources" }),
    ).toBeVisible();
    const page_ = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      view: window.innerHeight,
    }));
    expect(page_.scroll).toBeLessThanOrEqual(page_.view);
  });

  test("the org menu offers workspace settings to the manager", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await nav(page).getByRole("button", { name: "Calder Lane" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Workspace settings" }),
    ).toHaveAttribute("href", "/workspace/settings");
  });

  test("the account menu offers workspace settings to Priya", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await openAccount(page, "Priya Raman");
    await expect(
      page.getByRole("menuitem", { name: "Workspace settings" }),
    ).toHaveAttribute("href", "/workspace/settings");
  });

  test("Dan sees workspace settings disabled, and who manages it", async ({
    page,
  }) => {
    await signInAs(page, "dan");
    await page.goto("/me");
    await openAccount(page, "Dan Okafor");
    const item = page.getByRole("menuitem", { name: /Workspace settings/ });
    await expect(item).toHaveAttribute("aria-disabled", "true");
    await expect(item).toContainText("Managed by Priya Raman");
    await expect(item).not.toHaveAttribute("href", /.*/);
  });

  test("the persona switch keeps the demo where it was", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await openAccount(page, "Priya Raman");
    await page.getByRole("menuitem", { name: "Switch to Dan's view" }).click();
    await expect(page).toHaveURL("/me");
    await expect(
      page.getByRole("heading", { level: 1, name: "Good afternoon, Dan" }),
    ).toBeVisible();
    await expect(nav(page).getByText("Wed 16 Sep, 2:00 PM")).toBeVisible();

    await openAccount(page, "Dan Okafor");
    await page
      .getByRole("menuitem", { name: "Switch to Priya's view" })
      .click();
    await expect(page).toHaveURL("/manager");
    await expect(nav(page).getByText("Week 2 of 4")).toBeVisible();
  });

  test("the side nav paints at the saved width in the server HTML", async ({
    page,
    context,
  }) => {
    await signInAs(page, "priya");
    const html = async (value?: string) => {
      await context.clearCookies({ name: "ltw-sidenav" });
      if (value)
        await context.addCookies([
          { name: "ltw-sidenav", value, url: "http://localhost:3000" },
        ]);
      return await (await page.request.get("/manager")).text();
    };
    expect(await html("w320")).toContain(
      'class="ltw-sn" style="width:320px;transition:none"',
    );
    expect(await html("c320")).toContain(
      'class="ltw-sn ltw-sn-col" style="transition:none"',
    );
    // Nothing saved: CSS decides between expanded and the rail by width.
    expect(await html()).toContain(
      'class="ltw-sn ltw-sn-auto" style="transition:none"',
    );
  });

  test.describe("with JavaScript off", () => {
    test.use({ javaScriptEnabled: false });

    test("a saved rail paints as the rail", async ({ page, context }) => {
      await signInAs(page, "priya");
      await context.addCookies([
        { name: "ltw-sidenav", value: "c300", url: "http://localhost:3000" },
      ]);
      await page.goto("/manager");
      await expect(nav(page)).toHaveCSS("width", "48px");
      const toggle = nav(page).getByRole("button", { name: /navigation/i });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAccessibleName(/\S/);
    });
  });

  test("resize and collapse survive a reload", async ({ page }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await expect(nav(page)).toHaveCSS("width", "256px");
    await page.getByRole("separator", { name: "Resize navigation" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.reload();
    await expect(nav(page)).toHaveCSS("width", "272px");
    await nav(page).getByRole("button", { name: "Collapse" }).click();
    await page.reload();
    await expect(nav(page)).toHaveCSS("width", "48px");
    await nav(page).getByRole("button", { name: "Expand navigation" }).click();
    await expect(nav(page)).toHaveCSS("width", "272px");
  });

  test("below 1056px with nothing saved, the shell opens on the rail", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto("/manager");
    await expect(nav(page)).toHaveCSS("width", "48px");
    await expect(
      page.getByText(DISCLAIMER).filter({ visible: true }),
    ).toHaveCount(1);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the demo banner sits above everything, ${scheme}`, async ({
      page,
    }) => {
      await signInAs(page, "priya");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/manager");
      const box = (await banner(page).boundingBox())!;
      expect(box.y).toBe(0);
      expect(box.width).toBe(1440);
      expect(box.height).toBe(32);
      expect((await nav(page).boundingBox())!.y).toBeGreaterThanOrEqual(32);
      await expect(banner(page)).toHaveCSS(
        "background-color",
        TOKENS[scheme].highlight,
      );
      await expect(banner(page)).toHaveCSS("position", "static");
    });

    for (const [who, path] of [
      ["priya", "/manager"],
      ["priya", "/manager/outcomes"],
      ["dan", "/me"],
    ] as const) {
      test(`${path} passes axe, ${scheme}`, async ({
        page,
        expectAxeClean,
      }) => {
        await signInAs(page, who);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator("body")).toHaveCSS(
          "background-color",
          TOKENS[scheme].background,
        );
        await expectAxeClean(page);
      });
    }
  }

  test("on a phone the banner tops the top bar, and the drawer holds the nav @mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, "dan");
    await page.goto("/me");
    const top = (await banner(page).boundingBox())!;
    expect(top.y).toBe(0);
    expect(top.height).toBeGreaterThanOrEqual(48);
    const bar = page.getByRole("banner");
    const barBox = (await bar.boundingBox())!;
    expect(barBox.y).toBeGreaterThanOrEqual(top.height);
    // M2: the menu on the left, the person's avatar on the right.
    const menu = (await bar
      .getByRole("button", { name: "Open menu" })
      .boundingBox())!;
    const avatar = bar.getByRole("button", { name: "Dan Okafor" });
    const avatarBox = (await avatar.boundingBox())!;
    expect(menu.x).toBe(barBox.x);
    expect(avatarBox.x + avatarBox.width).toBe(barBox.x + barBox.width);
    await avatar.click();
    await expect(
      page.getByRole("menuitem", { name: "Switch to Priya's view" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByText(DISCLAIMER).filter({ visible: true }),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await drawer.getByRole("link", { name: "My sprint" }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL("/me/sprint");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`/me on a phone passes axe, ${scheme} @mobile`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await signInAs(page, "dan");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/me");
      await expect(page.getByRole("banner")).toBeVisible();
      await expectAxeClean(page);
    });
  }

  test("sign out ends at log in", async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto("/me");
    await openAccount(page, "Dan Okafor");
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login/);
  });
});

test("a real workspace has no demo banner, and shows the empty overview before launch", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Sam Lee");
  await page.getByLabel("Work email").fill(`e2e-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a long enough password");
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/setup/team");
  await page.goto("/manager");
  await expect(
    page.getByRole("heading", { level: 1, name: /^Good \w+, Sam$/ }),
  ).toBeVisible();
  await expect(page.getByText(EMPTY_OVERVIEW)).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test("marketing and auth pages have no demo banner", async ({ page }) => {
  for (const path of ["/", "/login", "/signup"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  }
});

test("the app re-reads the server at the top of the hour (Ruling 14)", async ({
  page,
}) => {
  await page.clock.install();
  await signInAs(page, "priya");
  await page.goto("/manager");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const now = await page.evaluate(() => Date.now());
  // router.refresh() refetches the page's server components (an RSC request, not a prefetch).
  const refresh = page.waitForRequest(
    (r) =>
      new URL(r.url()).pathname === "/manager" &&
      r.headers()["rsc"] === "1" &&
      r.headers()["next-router-prefetch"] === undefined,
  );
  await page.clock.fastForward(3_600_000 - (now % 3_600_000) + 60_000);
  await refresh;
});
