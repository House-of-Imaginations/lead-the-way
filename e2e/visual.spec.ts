import type { Page } from "@playwright/test";
import { resetCareers } from "./careers";
import { type Persona, resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

// Screenshot baselines at 1440, light (P15). Each group's clock target fixes
// every date and count on screen; the demo banner and clock are masked.
// Update with `pnpm exec playwright test e2e/visual.spec.ts --update-snapshots`.
// The -linux set comes from mcr.microsoft.com/playwright:v1.63.0-noble (the
// installed @playwright/test version) run with --network host against pnpm dev.
test.describe.configure({ mode: "serial" });
test.afterAll(() => resetDemo());

const GROUPS: {
  name: string;
  reset: () => void;
  who: Persona | null;
  paths: string[];
}[] = [
  {
    name: "team at week 4",
    reset: () => resetDemo("week4"),
    who: "priya",
    paths: ["/manager", "/manager/outcomes"],
  },
  {
    name: "Dan at week 4",
    reset: () => resetDemo("week4"),
    who: "dan",
    paths: ["/me", "/me/project"],
  },
  {
    name: "Amara at careers week 2",
    reset: () => resetCareers("week2"),
    who: "amara",
    paths: ["/careers/map", "/careers/week", "/careers/crew/join"],
  },
  {
    name: "Amara after proof",
    reset: () => resetCareers("proof"),
    who: "amara",
    paths: ["/careers/proof"],
  },
  // The guide needs a session (G-a); /start is signed out.
  {
    name: "signed out",
    reset: () => resetDemo(),
    who: null,
    paths: ["/start"],
  },
  {
    name: "the guide",
    reset: () => resetDemo(),
    who: "priya",
    paths: ["/guide"],
  },
];

const masks = (page: Page) => [
  page.locator("nextjs-portal, .ltw-demo, [aria-label='Demo clock']"),
];

for (const { name, reset, who, paths } of GROUPS)
  test.describe(name, () => {
    test.beforeAll(reset);
    for (const path of paths)
      test(`${path} matches its baseline`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.emulateMedia({ colorScheme: "light" });
        if (who) await signInAs(page, who);
        await page.goto(path);
        await expect(
          page.getByRole("heading", { level: 1 }).first(),
        ).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(
          `${path.slice(1).replaceAll("/", "-") || "home"}.png`,
          {
            mask: masks(page),
            animations: "disabled",
            maxDiffPixelRatio: 0.01,
          },
        );
      });
  });
