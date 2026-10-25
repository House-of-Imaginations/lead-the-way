import { expect, type Page } from "@playwright/test";

/** A personal address: not Dan's login, and off Calder Lane's domain (X3). */
export const PERSONAL_EMAIL = "dan.okafor.home@example.com";

/** MS3 through the page, for a signed-in team-only account. Lands on MS2. */
export async function startPrivateTrack(page: Page, email = PERSONAL_EMAIL) {
  await page.goto("/tracks/private/new");
  await page.getByLabel("Email for this track").fill(email);
  await page
    .getByRole("checkbox", {
      name: "Keep this track private from my workspace.",
    })
    .check();
  await page.getByRole("button", { name: "Start my map" }).click();
  await expect(page).toHaveURL("/home");
}
