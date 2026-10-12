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

/**
 * Text of the read-or-pressed elements that poke past the viewport or overflow
 * their own box. Elements, not the page's scrollWidth: .lp clips sideways
 * overflow. clientWidth, not innerWidth, so a scrollbar counts as outside.
 */
export const spilledElements = (page: Page) =>
  page
    .locator(
      ".lp :is(h1, h2, h3, h4, p, dt, dd, li, blockquote, figcaption, a, button)",
    )
    .evaluateAll((els) => {
      const width = document.documentElement.clientWidth;
      return els
        .filter((e) => e.checkVisibility())
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.right > width + 1 ||
            r.left < -1 ||
            e.scrollWidth > e.clientWidth + 1
          );
        })
        .map((e) => (e.textContent ?? e.tagName).trim().slice(0, 40));
    });

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
