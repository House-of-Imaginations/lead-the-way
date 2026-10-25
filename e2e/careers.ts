import { expect, type Page } from "@playwright/test";
import { E2E_DOMAIN, convex } from "./demo";

/** Reseed, then move the careers clock (`seed:careerClock`) through `targets` in order. */
export function resetCareers(
  ...targets: ("week2" | "week3" | "proof" | "missedWeek")[]
) {
  convex(["run", "seed:reset"]);
  for (const target of targets)
    convex(["run", "seed:careerClock", JSON.stringify({ target })]);
}

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

/**
 * A fresh career learner heading to Business Analyst: Kofi's crew has room
 * (Lena's Data Analyst crew is full). Lands on the track's home.
 */
export async function signUpCareer(page: Page) {
  await page.goto(`/careers/map/new?partner=${PARTNER}`);
  await page
    .getByLabel("Where do you want to go?")
    .selectOption("Business Analyst");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Build my map" }).click();
  await expect(page).toHaveURL("/careers/map");
  await page.goto("/signup?track=career");
  await page.getByLabel("First name").fill("Sam");
  await page
    .getByLabel("Email", { exact: true })
    .fill(
      `e2e-crew-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`,
    );
  await page
    .getByLabel("Password", { exact: true })
    .fill("a long enough password");
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await page.getByRole("button", { name: "Create free account" }).click();
  // `viewer.home` for a career learner (its page is P13b part B's).
  await expect(page).not.toHaveURL(/\/signup/);
}
