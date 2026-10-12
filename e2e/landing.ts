import { expect, type Page } from "@playwright/test";

/** Scroll the whole page in steps so every once-only trigger fires. Instant: the landing scrolls smoothly by default. */
export async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const twoFrames = () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 300) {
      window.scrollTo({ top: y, behavior: "instant" });
      await twoFrames();
    }
  });
}

/** The finished page: where motion ends, and what reduced motion shows from the start. */
export async function expectFinished(page: Page) {
  await expect(page.locator("#results .num b")).toHaveText(["8", "7", "6"]);
  // Bar length is the matrix's x scale, rounded: 2.8 / 5 is 0.5599... in JS.
  await expect
    .poll(() =>
      page.locator(".bar .t i").evaluateAll((bars) =>
        bars.map((b) => {
          const { a } = new DOMMatrix(getComputedStyle(b).transform);
          return Math.round(a * 100) / 100;
        }),
      ),
    )
    .toEqual([0.56, 0.8, 0.52, 0.78]);
  await expect
    .poll(() =>
      page
        .locator("[data-intro], [data-rise], [data-row], .mf .w")
        .evaluateAll(
          (els) =>
            els.filter((e) => getComputedStyle(e).opacity !== "1").length,
        ),
    )
    .toBe(0);
}
