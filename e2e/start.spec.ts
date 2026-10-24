import type { Page } from "@playwright/test";
import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

// The label is what people click; the radio inside it holds the state (one choice, L5).
const tile = (page: Page, name: string) =>
  page.locator("label.ltw-track", { hasText: name });
const radio = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Choose a track" })
    .getByRole("radio", { name });
const footer = (page: Page, name: string) =>
  page.getByRole("link", { name, exact: true });

test("Continue waits for a track and a way in", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByText("Pick a track to continue.")).toBeVisible();

  await tile(page, "Grow in my role").click();
  await expect(radio(page, "Grow in my role")).toBeChecked();
  await expect(radio(page, "Change careers")).not.toBeChecked();
  const ways = page.getByRole("group", { name: "How are you joining?" });
  await expect(ways).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(
    page.getByText("Choose how you join to continue."),
  ).toBeVisible();
  await expect(page.getByText("Pick a track to continue.")).toHaveCount(0);

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
  await expect(radio(page, "Change careers")).toBeChecked();
  await expect(radio(page, "Grow in my role")).not.toBeChecked();
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
  // M1: Dan is already on a team, so he is never asked how he joins, and
  // never told to open an invitation.
  await tile(page, "Grow in my role").click();
  await expect(
    page.getByRole("group", { name: "How are you joining?" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("My manager invited me")).toHaveCount(0);
  await expect(page.getByText("Open my invitation")).toHaveCount(0);
  await expect(footer(page, "Continue")).toHaveAttribute("href", "/home");
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
});

// M2: the stair blocks sit below the panel tiles at laptop heights.
for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [1024, 768],
]) {
  test(`the panel tiles clear the stair blocks at ${width} by ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/start");
    const aside = page.locator("aside");
    const blocks = (await aside
      .locator(":scope > div[aria-hidden='true']")
      .boundingBox())!;
    for (const name of ["Grow in my role", "Change careers"]) {
      const card = (await aside
        .locator("div", {
          has: page.getByRole("heading", { name, exact: true }),
        })
        .last()
        .boundingBox())!;
      expect(card.y + card.height).toBeLessThanOrEqual(blocks.y);
    }
    await expect(
      page.getByText("No employer sees anything, not even that you started."),
    ).toBeVisible();
  });
}

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
      // S2: focus order is what people see, the log in line above the
      // sticky footer on a phone and below the button from 1024px.
      const logIn = page.getByRole("link", { name: "Log in" });
      const login = (await logIn.boundingBox())!;
      const loginFirst = await logIn.evaluate(
        (link, b) =>
          !!(
            link.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING
          ),
        await go.elementHandle(),
      );
      expect(loginFirst).toBe(login.y < button.y);
      if (width === 1440) {
        expect(login.y).toBeGreaterThan(button.y);
        expect(career.y).toBe(team.y);
        await expect(panel).toBeVisible();
        await expect(note).toBeHidden();
        expect(button.width).toBe(320);
      } else {
        expect(login.y).toBeLessThan(button.y);
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
