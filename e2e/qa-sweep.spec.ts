import type { Browser, Locator, Page } from "@playwright/test";
import { PARTNER, resetCareers } from "./careers";
import {
  type DemoTarget,
  type Persona,
  PERSONA,
  demoBadgeSlug,
  resetDemo,
  seedCareer,
  signInAs,
} from "./demo";
import { expect, test } from "./fixtures";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const WIDTHS = [390, 768, 1056, 1440];

/** The careers clock (`seed:careerClock`) after a reseed, or Dan with a private career track at week 2. */
type CareersAt = "careers week2" | "careers week3" | "careers proof";
type At = DemoTarget | CareersAt | "dan two tracks";

function prepare(at: At) {
  if (at === "dan two tracks") {
    resetDemo("week2");
    seedCareer(PERSONA.dan);
  } else if (at.startsWith("careers "))
    resetCareers(at.slice("careers ".length) as "week2" | "week3" | "proof");
  else resetDemo(at as DemoTarget);
}

/** Amara's public proof link, made (or read) on 6 Prove it. */
async function proofSlug(browser: Browser): Promise<string> {
  const page = await browser.newPage();
  await signInAs(page, "amara");
  await page.goto("/careers/proof");
  const create = page.getByRole("button", { name: "Create link" });
  if (await create.isVisible()) await create.click();
  const link = page.getByText(/^\/proof\/.+/);
  await expect(link).toBeVisible();
  const slug = (await link.textContent())!.replace("/proof/", "");
  await page.close();
  return slug;
}

/**
 * `#<tab>` opens that tab after load; `:slug` is Dan's credential slug and
 * `:proof` Amara's proof slug. The guides need a session (G-a), any one.
 */
const ROUTES: { path: string; who: Persona | null; at: At }[] = [
  ...[
    "/login",
    "/signup",
    "/reset-password",
    "/credential/:slug",
    "/",
    "/start",
    `/p/${PARTNER}`,
    "/careers/map/new",
    "/signup?track=career",
    "/login?track=career",
    "/demo/partner-email",
  ].map((path) => ({ path, who: null, at: "week4" as const })),
  { path: "/proof/:proof", who: null, at: "careers proof" },
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
    "/guide",
    "/guide/team",
    "/guide/careers",
    "/guide/blueprint",
  ].map((path) => ({ path, who: "priya" as const, at: "week2" as const })),
  ...[
    "/me",
    "/me/sprint",
    "/me/project",
    "/me/show-and-tell",
    "/me/credential",
    "/me/agreement",
    "/me/settings",
    // MS3 is for a team-only account: Dan before he has a private track.
    "/tracks/private/new",
  ].map((path) => ({ path, who: "dan" as const, at: "week2" as const })),
  ...[
    "/careers/map",
    "/careers/week",
    "/careers/crew/join",
    "/careers/crew/hours",
    "/careers/journey",
    "/careers/settings",
  ].map((path) => ({
    path,
    who: "amara" as const,
    at: "careers week2" as const,
  })),
  // Week 3 has the project written up; proof needs the badge.
  { path: "/careers/crew/demo-day", who: "amara", at: "careers week3" },
  { path: "/careers/proof", who: "amara", at: "careers proof" },
  ...["/home", "/settings/privacy"].map((path) => ({
    path,
    who: "dan" as const,
    at: "dan two tracks" as const,
  })),
];

let slug = "";
let proof = "";
test.afterAll(() => resetDemo());

async function visit(page: Page, path: string) {
  const [url, tab] = path
    .replace(":slug", slug)
    .replace(":proof", proof)
    .split("#");
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

const groups = Map.groupBy(ROUTES, (r) => `${r.at} ${r.who ?? "signed out"}`);

for (const [name, routes] of groups) {
  const { at, who } = routes[0];
  test.describe(name, () => {
    test.beforeAll(async ({ browser }) => {
      prepare(at);
      if (routes.some((r) => r.path.includes(":slug"))) slug = demoBadgeSlug();
      if (routes.some((r) => r.path.includes(":proof")))
        proof = await proofSlug(browser);
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
          // Visible, not just attached: main's phone copy is always in the DOM (M4).
          await expect(
            page.getByText(DISCLAIMER).filter({ visible: true }).first(),
          ).toBeVisible();
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
              // R14, as landing.spec.ts: the landing's manifesto sits at 16%
              // until it is scrolled through, so axe reads it with motion off.
              await page.emulateMedia({
                colorScheme,
                reducedMotion: path === "/" ? "reduce" : null,
              });
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

  test("Amara proposes a crew rule by keyboard", async ({ page }) => {
    await signInAs(page, "amara");
    await page.goto("/careers/crew/join");
    const rule = page.getByLabel("Add your own rule");
    await expect(rule).toBeVisible();
    await tabTo(page, rule);
    await page.keyboard.type("Share one useful link a week");
    await tabTo(page, page.getByRole("button", { name: "Add", exact: true }));
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("checkbox", { name: "Share one useful link a week" }),
    ).toBeVisible();
    await expect(rule).toHaveValue("");
  });
});
