import type { Locator, Page } from "@playwright/test";
import { resetCareers } from "./careers";
import { resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

test.describe.configure({ mode: "serial" });
test.afterAll(() => resetDemo());

const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** R11: the mark opts out of forced colours and still paints something. */
async function expectForcedMark(mark: Locator, name: string) {
  const style = await mark.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      adjust: s.forcedColorAdjust,
      background: s.backgroundColor,
      border: s.borderTopColor,
    };
  });
  expect(style.adjust, name).toBe("none");
  expect(
    style.background !== TRANSPARENT || style.border !== TRANSPARENT,
    name,
  ).toBe(true);
}

/** For the PR. output/ is git-ignored. */
async function shoot(target: Locator, name: string) {
  const path = `output/screens/qa-${name}.png`;
  await target.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

/** 03 saved as its PNG has it (6 to 10 people), which lands on 04 with "8 hrs". */
async function saveTeam(page: Page) {
  await page.goto("/setup/team");
  await page
    .getByRole("group", { name: "Team size" })
    .getByRole("button", { name: "6 to 10" })
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/setup/team?page=2");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/setup/protected-hour");
}

test("forced colours keep the chosen tile dot, toggle, checkbox and progress visible (R11)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ forcedColors: "active" });

  resetDemo("setup");
  await signInAs(page, "priya");
  await page.goto("/setup/team");
  const tiles = page.getByRole("group", {
    name: "How does your team use AI today?",
  });
  const dot = tiles.getByRole("radio").first();
  await dot.check();
  await expectForcedMark(dot, "tile dot");
  await shoot(tiles, "forced-tile");

  await page.goto("/setup/team?page=2");
  const box = page.getByRole("checkbox").first();
  await box.check();
  // A native checkbox: its mark is drawn in accent-color, not a background.
  const cb = await box.evaluate((el) => {
    const s = getComputedStyle(el);
    return { adjust: s.forcedColorAdjust, accent: s.accentColor };
  });
  expect(cb.adjust).toBe("none");
  expect(cb.accent).not.toBe("auto");
  await shoot(box.locator("xpath=ancestor::fieldset[1]"), "forced-checkbox");

  resetDemo("week1");
  await page.context().clearCookies();
  await signInAs(page, "dan");
  await page.goto("/me/settings");
  const toggle = page.getByRole("switch").first();
  await expect(toggle).toBeVisible();
  await expectForcedMark(toggle, "toggle");
  // 19's NeverSees bullets are 6px fills, which forced colours would drop (M5).
  await expectForcedMark(
    page.getByRole("complementary").locator("li > span").first(),
    "never sees bullet",
  );
  await shoot(page.getByRole("main"), "forced-toggle");

  await page.goto("/me/sprint");
  const bar = page
    .getByRole("main")
    .getByRole("progressbar", { name: "Sprint progress" });
  await expectForcedMark(bar, "progress track");
  await expectForcedMark(bar.locator(".ltw-pb-fill"), "progress fill");
  await shoot(bar.locator(".."), "forced-progress");
});

test("forced colours keep the careers marks visible", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ forcedColors: "active" });
  resetCareers("week2");
  await signInAs(page, "amara");
  const main = page.getByRole("main");

  // 3: every skill's border turns CanvasText, so the chosen one needs its own.
  await page.goto("/careers/map");
  const chosen = main.getByRole("button", { pressed: true });
  await expectForcedMark(chosen, "chosen skill");
  const border = (l: Locator) =>
    l.evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(await border(chosen)).not.toBe(
    await border(main.getByRole("button", { pressed: false }).first()),
  );
  await shoot(chosen.locator("xpath=ancestor::ul[1]"), "forced-skill");

  // 5: the shared progress bar, and status icons that keep a painted fill.
  await page.goto("/careers/week");
  const bar = main.getByRole("progressbar", { name: "Credential progress" });
  await expectForcedMark(bar, "credential progress track");
  await expectForcedMark(
    bar.locator(".ltw-pb-fill"),
    "credential progress fill",
  );
  const lessons = main.locator("ul", {
    has: page.locator("li[aria-current=step]"),
  });
  for (const icon of await lessons.locator("svg").all())
    expect(
      await icon.evaluate((el) => getComputedStyle(el).fill),
      "lesson icon",
    ).not.toMatch(/^(none|rgba\(0, 0, 0, 0\))$/);
  await shoot(lessons, "forced-lessons");

  // 4b: the calendar's learning and crew cells, and their legend.
  await page.goto("/careers/crew/hours");
  const week1 = main.getByRole("row", { name: /^Week 1/ }).getByRole("cell");
  await expectForcedMark(week1.nth(1), "crew cell");
  await expectForcedMark(week1.nth(3), "learning cell");
  for (const swatch of await main.locator("li > span[aria-hidden]").all())
    await expectForcedMark(swatch, "legend swatch");
  await shoot(main.getByRole("table"), "forced-hours");

  // 4: the Crew Agreement's native checkboxes, as R11's.
  await page.goto("/careers/crew/join");
  const boxes = main.getByRole("checkbox");
  await expect(boxes.first()).toBeVisible();
  for (const box of await boxes.all()) {
    const cb = await box.evaluate((el) => {
      const s = getComputedStyle(el);
      return { adjust: s.forcedColorAdjust, accent: s.accentColor };
    });
    expect(cb.adjust).toBe("none");
    expect(cb.accent).not.toBe("auto");
  }
});

test("04 at 1280: the preview's hours sit top right and time chips stay on one line", async ({
  page,
}) => {
  resetDemo("setup");
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInAs(page, "priya");
  await saveTeam(page);
  const preview = page.getByRole("region", { name: "Calendar preview" });
  const heading = (await preview.getByRole("heading").boundingBox())!;
  const hours = (await preview
    .getByText("8 hrs", { exact: true })
    .boundingBox())!;
  expect(Math.abs(hours.y - heading.y)).toBeLessThanOrEqual(4);
  expect(hours.x).toBeGreaterThan(heading.x + heading.width);
  // The title breaks after the day, never inside "2:00 PM": the times are one 28px line.
  const times = preview.getByText("2:00 PM to 3:00 PM", { exact: true });
  expect((await times.boundingBox())!.height).toBeLessThanOrEqual(28);

  const chips = preview.getByText("Learn 2 PM", { exact: true });
  await expect(chips).toHaveCount(4);
  const first = (await chips.first().boundingBox())!;
  // One 16px line of label-01 plus 2px top and bottom.
  expect(first.height).toBeLessThanOrEqual(20);
  for (const chip of await chips.all())
    expect((await chip.boundingBox())!.height).toBe(first.height);
  await shoot(preview, "04-1280-preview");
});

for (const width of [1280, 1440]) {
  test(`the notes panel never covers the setup footer's primary button at ${width}`, async ({
    page,
  }) => {
    resetDemo("setup");
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() =>
      localStorage.setItem("ltw-prototype-notes", "on"),
    );
    await signInAs(page, "priya");
    await page.goto("/setup/team");
    const panel = page.getByRole("complementary", { name: "Prototype notes" });
    await expect(panel).toBeVisible();
    const button = page.getByRole("button", { name: "Continue" });
    // The footer is the page's last row, so this scrolls to the bottom.
    await button.scrollIntoViewIfNeeded();
    const a = (await panel.boundingBox())!;
    const b = (await button.boundingBox())!;
    const overlap =
      a.x < b.x + b.width &&
      b.x < a.x + a.width &&
      a.y < b.y + b.height &&
      b.y < a.y + a.height;
    expect(overlap).toBe(false);
    await page.screenshot({ path: `output/screens/qa-notes-${width}.png` });
  });
}

test("Run another sprint goes straight to the draft overview (C-M-1)", async ({
  page,
}) => {
  resetDemo("complete");
  await signInAs(page, "priya");
  await page.goto("/manager");
  const before = await page.getByRole("heading", { level: 1 }).textContent();
  // Client navigation keeps the document, so one observer sees every h1.
  await page.evaluate(() => {
    const w = window as unknown as { h1s: string[] };
    w.h1s = [];
    const record = () => {
      const text = [...document.querySelectorAll("h1")]
        .map((h) => h.textContent)
        .join(" | ");
      if (text && w.h1s.at(-1) !== text) w.h1s.push(text);
    };
    record();
    new MutationObserver(record).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  await page.getByRole("button", { name: "Run another sprint" }).click();
  await expect(page).toHaveURL("/setup/protected-hour");
  // Polled until the draft's h1 is recorded: a flash in between never matches.
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { h1s: string[] }).h1s),
    )
    .toEqual([before, "Make learning part of the working week"]);
});
