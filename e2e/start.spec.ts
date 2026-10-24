import type { Page } from "@playwright/test";
import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

const tile = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(name) });
const footer = (page: Page, name: string) =>
  page.getByRole("link", { name, exact: true });

test("Continue waits for a track and a way in", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByText("Pick a track to continue.")).toBeVisible();

  await tile(page, "Grow in my role").click();
  await expect(tile(page, "Grow in my role")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const ways = page.getByRole("group", { name: "How are you joining?" });
  await expect(ways).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  await ways.getByLabel("I lead a team").check();
  await expect(footer(page, "Set up team")).toHaveAttribute(
    "href",
    "/signup?track=team",
  );

  await ways.getByLabel("My manager invited me").check();
  await expect(
    page.getByRole("button", { name: "Open my invitation" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Open the link in your invitation email to join your team."),
  ).toBeVisible();

  await tile(page, "Change careers").click();
  await expect(ways).toHaveCount(0);
  await expect(footer(page, "Start my map")).toHaveAttribute(
    "href",
    "/careers/map/new",
  );
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("Dan's choices follow his account", async ({ page }) => {
  resetDemo("week2");
  await signInAs(page, "dan");
  await page.goto("/start");
  await tile(page, "Change careers").click();
  await expect(footer(page, "Start my map")).toHaveAttribute(
    "href",
    "/tracks/private/new",
  );
  await tile(page, "Grow in my role").click();
  await page.getByLabel("I lead a team").check();
  await expect(footer(page, "Set up team")).toHaveAttribute("href", "/home");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
});

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`/start at ${width}, ${colorScheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      const height = width === 390 ? 844 : 900;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await page.goto("/start");
      await expectAxeClean(page);

      const team = (await tile(page, "Grow in my role").boundingBox())!;
      const career = (await tile(page, "Change careers").boundingBox())!;
      const panel = page.getByRole("heading", {
        name: "One account. Either track. Or both.",
      });
      const note = page.getByText("Already in a team sprint?");
      const go = page.getByRole("button", { name: "Continue" });
      const button = (await go.boundingBox())!;
      if (width === 1440) {
        expect(career.y).toBe(team.y);
        await expect(panel).toBeVisible();
        await expect(note).toBeHidden();
        expect(button.width).toBe(320);
      } else {
        expect(career.y).toBeGreaterThanOrEqual(team.y + team.height);
        await expect(panel).toBeHidden();
        await expect(note).toBeVisible();
        expect(button.width).toBeGreaterThanOrEqual(358);
        // Sticky: still in view, at the bottom, once the way-in rows grow the page.
        await tile(page, "Grow in my role").click();
        const pinned = (await go.boundingBox())!;
        expect(pinned.y + pinned.height).toBeLessThanOrEqual(height);
        expect(pinned.y + pinned.height).toBeGreaterThan(height - 64);
      }
    });
  }
}
