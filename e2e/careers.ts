import { expect, type Page } from "@playwright/test";

/** The seeded partner (`convex/lib/demo/pivotCrews.ts`). */
export const PARTNER = "footscray-library";

/** Every width and theme a careers screen is checked at (spec 9). */
export const LOOKS = [390, 1440].flatMap((width) =>
  (["light", "dark"] as const).map((colorScheme) => ({ width, colorScheme })),
);

export async function look(
  page: Page,
  width: number,
  colorScheme: "light" | "dark",
) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.emulateMedia({ colorScheme });
}

/** 2 Tell us with its defaults (Retail Store Manager to Data Analyst, 2 hours), then the map. */
export async function buildMap(page: Page, hours?: "1 hr" | "2 hrs" | "3 hrs") {
  await page.goto(`/careers/map/new?partner=${PARTNER}`);
  if (hours) await page.getByRole("button", { name: hours }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Build my map" }).click();
  await expect(page).toHaveURL("/careers/map");
}
