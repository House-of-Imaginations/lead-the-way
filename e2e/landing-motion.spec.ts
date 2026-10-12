import { expectFinished, scrollThrough } from "./landing";
import { expect, test } from "./fixtures";

test("with motion, everything arrives once it is scrolled to", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".lp")).toHaveAttribute("data-motion", "on");
  await scrollThrough(page);
  await expectFinished(page);
});

test.describe("with motion reduced by the OS", () => {
  test.use({ reducedMotion: "reduce" });

  test("the page is finished from the start", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".lp")).toHaveAttribute("data-motion", "off");
    await expect(page.locator(".hero-copy > [data-intro]").first()).toHaveCSS(
      "animation-name",
      "none",
    );
    await expectFinished(page);
  });
});

test("with motion reduced by Settings' Reduce motion, the page is finished from the start", async ({
  page,
}) => {
  // The app shell's attribute, set before the page's own scripts run.
  await page.addInitScript(() => {
    const mark = () =>
      document.documentElement.setAttribute("data-reduce-motion", "");
    if (document.documentElement) mark();
    else
      new MutationObserver((_, observer) => {
        if (!document.documentElement) return;
        mark();
        observer.disconnect();
      }).observe(document, { childList: true });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "");
  await expect(page.locator(".lp")).toHaveAttribute("data-motion", "off");
  await expect(page.locator(".hero-copy > [data-intro]").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await expectFinished(page);
});

test("leaving and coming back leaves no motion behind", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /gsap|scrolltrigger/i.test(m.text()))
      problems.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator(".lp")).toHaveAttribute("data-motion", "on");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Log in", exact: true })
    .click();
  await expect(page).toHaveURL("/login");
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".lp")).toHaveAttribute("data-motion", "on");
  await scrollThrough(page);
  await expectFinished(page);
  // No section pins, so a spacer means ScrollTrigger left its DOM edits behind.
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  expect(problems).toEqual([]);
});
