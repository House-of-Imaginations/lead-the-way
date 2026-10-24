import type { Locator, Page } from "@playwright/test";
import {
  type DemoTarget,
  type Persona,
  demoBadgeSlug,
  resetDemo,
  signInAs,
} from "./demo";
import { expect, test } from "./fixtures";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const WIDTHS = [390, 768, 1056, 1440];

/** `#<tab>` opens that tab after load; `:slug` is Dan's credential slug. */
const TEAM_ROUTES: { path: string; who: Persona | null; at: DemoTarget }[] = [
  { path: "/login", who: null, at: "week4" },
  { path: "/signup", who: null, at: "week4" },
  { path: "/reset-password", who: null, at: "week4" },
  { path: "/credential/:slug", who: null, at: "week4" },
  { path: "/setup/team", who: "priya", at: "setup" },
  { path: "/setup/protected-hour", who: "priya", at: "setup" },
  ...[
    "/manager",
    "/manager/learning",
    "/manager/agreement",
    "/manager/sprint/launch",
    "/manager/outcomes",
    "/join/preview",
    "/settings",
    "/workspace/settings#General",
    "/workspace/settings#Members",
    "/workspace/settings#Sprint defaults",
    "/workspace/settings#Data and privacy",
    "/workspace/settings#Roles",
    "/workspace/new",
  ].map((path) => ({ path, who: "priya" as const, at: "week2" as const })),
  ...[
    "/me",
    "/me/sprint",
    "/me/project",
    "/me/show-and-tell",
    "/me/credential",
    "/me/agreement",
    "/me/settings",
  ].map((path) => ({ path, who: "dan" as const, at: "week2" as const })),
];

let slug = "";
test.afterAll(() => resetDemo());

async function visit(page: Page, path: string) {
  const [url, tab] = path.replace(":slug", slug).split("#");
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  if (tab) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(
      page.getByRole("tab", { name: tab, selected: true }),
    ).toBeVisible();
  }
  await page.waitForLoadState("networkidle");
}

const groups = Map.groupBy(
  TEAM_ROUTES,
  (r) => `${r.at} ${r.who ?? "signed out"}`,
);

for (const [name, routes] of groups) {
  const { at, who } = routes[0];
  test.describe(name, () => {
    test.beforeAll(() => {
      resetDemo(at);
      if (routes.some((r) => r.path.includes(":slug"))) slug = demoBadgeSlug();
    });
    test.beforeEach(async ({ page }) => {
      if (who) await signInAs(page, who);
    });

    for (const { path } of routes) {
      test(`${path} fits at 390, 768, 1056 and 1440 @mobile`, async ({
        page,
      }) => {
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await visit(page, path);
          const sizes = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            inner: window.innerWidth,
          }));
          expect(sizes.scroll, `${path} at ${width}`).toBeLessThanOrEqual(
            sizes.inner,
          );
          await expect(page.getByText(DISCLAIMER).first()).toBeAttached();
        }
      });

      test(`${path} is axe-clean in light and dark at 1440 and 390`, async ({
        page,
        expectAxeClean,
      }) => {
        test.setTimeout(90_000);
        for (const width of [1440, 390])
          for (const colorScheme of ["light", "dark"] as const) {
            await test.step(`${width} ${colorScheme}`, async () => {
              await page.setViewportSize({ width, height: 900 });
              await page.emulateMedia({ colorScheme });
              await visit(page, path);
              await expectAxeClean(page);
            });
          }
      });
    }
  });
}

/** Tab until `target` has focus; every stop must show the 2px focus outline. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return {
        outline: getComputedStyle(el).outlineWidth,
        what: `${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 40)}`,
      };
    });
    expect(focused.outline, focused.what).toBe("2px");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Tabbed 80 times without reaching the target.");
}

test.describe("keyboard", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => resetDemo("week2"));

  test("Priya reaches Settings and saves her profile by keyboard", async ({
    page,
  }) => {
    await signInAs(page, "priya");
    await page.goto("/manager");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const account = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Priya Raman" });
    await tabTo(page, account);
    await page.keyboard.press("Enter");
    const settings = page.getByRole("menuitem", {
      name: "Settings",
      exact: true,
    });
    await expect(settings).toBeVisible();
    for (let i = 0; i < 10; i++) {
      if (await settings.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("ArrowDown");
    }
    await expect(settings).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/settings");

    const title = page.getByLabel("Job title");
    await expect(title).toBeVisible();
    const before = await title.inputValue();
    await tabTo(page, title);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Head of Client Services");
    const save = page.getByRole("button", { name: "Save changes" });
    await tabTo(page, save);
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Changes saved.", { exact: true }),
    ).toBeVisible();

    await title.fill(before);
    await save.click();
    await page.reload();
    await expect(page.getByLabel("Job title")).toHaveValue(before);
  });

  test("Dan flips a privacy toggle by keyboard", async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto("/me/settings");
    const toggle = page.getByRole("switch", {
      name: "Include me in team totals",
    });
    await expect(toggle).toBeVisible();
    const start = await toggle.getAttribute("aria-checked");
    const flipped = start === "true" ? "false" : "true";
    await tabTo(page, toggle);
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", flipped);
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-checked", start!);
  });
});
