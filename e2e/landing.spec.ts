import { expect, test } from "./fixtures";
import { scrollThrough, spilledElements } from "./landing";

// Content checks read the finished page. From Task 2 on, motion starts the
// counters at 0 until they are scrolled to; landing-motion.spec.ts owns motion.
test.use({ reducedMotion: "reduce" });

const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const HEADINGS = [
  "Make AI learning part of the working week.",
  "It starts with you, then the whole team.",
  "You see the team, never the individual.",
  "Four weeks later, AI is part of how the team works.",
  "Nothing to design or buy.",
  "Start with one hour a week.",
];

test("the landing carries the approved copy with the fixed figures", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of HEADINGS)
    await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText(DISCLAIMER);

  // L-d: the team is 9 people; confidence starts at the seed's 2.8 (14 over 5).
  const results = page.locator("#results");
  await expect(results).toContainText(
    "Example sprint: Calder Lane Client Services, 9 people, 9 to 30 September 2026.",
  );
  await expect(
    results.getByText(
      "Team average on a 1 to 5 scale, 5 responses before and 7 after",
    ),
  ).toHaveCount(2);
  await expect(results.locator(".bar b")).toHaveText([
    "2.8",
    "4.0",
    "2.6",
    "3.9",
  ]);
  await expect(results.locator(".num b")).toHaveText(["8", "7", "6"]);
  await expect(page.locator("#kit h3").first()).toHaveText(
    "Leading AI at Work",
  );

  // The held-hour mark, not the source's stair.
  await expect(page.getByRole("banner").locator(".ltw-logo")).toHaveCount(1);
  await expect(page.getByRole("contentinfo").locator(".ltw-logo")).toHaveCount(
    1,
  );

  // DESIGN.md copy rules on everything a visitor can read.
  const text = await page.locator(".lp").innerText();
  expect(text).not.toMatch(/[‐-―−]/);
  expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(text).not.toContain("Your Team");
  const shouting = await page
    .locator(".lp *")
    .evaluateAll(
      (els) =>
        els.filter((e) => getComputedStyle(e).textTransform === "uppercase")
          .length,
    );
  expect(shouting).toBe(0);
  // Button-styled links: 1 to 3 words, starting with a verb.
  const labels = await page
    .locator(".lp .btn")
    .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));
  for (const label of labels) {
    expect(label.split(/\s+/).length, label).toBeLessThanOrEqual(3);
    expect(label, label).toMatch(/^(Start|See|Open|Go|Log)\b/);
  }
});

test("every link goes to a real route or an anchor on the page", async ({
  page,
}) => {
  await page.goto("/");
  const hrefs = await page
    .locator(".lp a[href]")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  const routes = new Set<string>();
  for (const href of hrefs) {
    if (href.startsWith("#"))
      await expect(page.locator(href), href).toHaveCount(1);
    else {
      expect(href, href).toMatch(/^\/(login|signup)$/);
      routes.add(href);
    }
  }
  expect([...routes].sort()).toEqual(["/login", "/signup"]);
  for (const route of routes) {
    const res = await page.request.get(route, { maxRedirects: 0 });
    expect(res.status(), route).toBe(200);
  }
});

test("the calls to action go where the rulings say", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(
    header.getByRole("link", { name: "See the prototype" }),
  ).toHaveAttribute("href", "/login");
  await expect(
    header.getByRole("link", { name: "Start your sprint" }),
  ).toHaveAttribute("href", "/signup");
  await expect(
    header.getByRole("link", { name: "Log in", exact: true }),
  ).toHaveAttribute("href", "/login");
  const main = page.getByRole("main");
  // The hero and the closing band.
  await expect(
    main.getByRole("link", { name: "Start your sprint" }),
  ).toHaveCount(2);
  await expect(
    main.getByRole("link", { name: "See the steps" }),
  ).toHaveAttribute("href", "#how");
  // L-b: plain starter-kit rows, no dead footer links.
  await expect(page.locator("#kit a")).toHaveCount(0);
  await expect(page.locator("#kit svg")).toHaveCount(0);
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Design system" })).toHaveCount(
    0,
  );
  await expect(footer.getByRole("link", { name: "Accessibility" })).toHaveCount(
    0,
  );
  await expect(
    footer.getByRole("link", { name: "Open the prototype" }),
  ).toHaveAttribute("href", "/login");
});

test("the sticky frame follows the step in view", async ({ page }) => {
  await page.goto("/");
  const frames = page.locator(".how-stage .frame");
  await expect(frames.nth(0)).toHaveClass(/\bon\b/);
  await page
    .locator('.step[data-step="3"]')
    .evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
    );
  await expect(frames.nth(3)).toHaveClass(/\bon\b/);
  await expect(page.locator(".how-stage .frame.on")).toHaveCount(1);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page is complete", async ({ page }) => {
    await page.goto("/");
    for (const name of HEADINGS)
      await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.locator("#results .num b")).toHaveText(["8", "7", "6"]);
    await expect(
      page.getByRole("img", { name: /Manager dashboard for Priya Raman/ }),
    ).toBeVisible();
  });
});

// R14: this file's reduced motion matters here. GSAP tweens are not Web
// Animations, so the fixture can't wait for them, and the manifesto sits at
// 16% until read.
for (const theme of ["light", "dark"] as const)
  for (const width of [1440, 390])
    test(`axe is clean, ${theme} at ${width}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?theme=${theme}`);
      await expectAxeClean(page);
    });

for (const theme of ["light", "dark"] as const)
  test(`axe is clean with the menu open, ${theme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?theme=${theme}`);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await expectAxeClean(page);

    // axe can't judge the menu's text: its ground is the sheet's ::before
    // (translucent and blurred), so color-contrast comes back "incomplete"
    // (pseudoContent) for every line, whatever the colours. So measure the
    // disclaimer: it is white, then hide it, photograph the ground behind
    // it and take the lightest pixel as the worst case.
    const fine = page.locator(".mnav-fine");
    await expect(fine).toHaveCSS("color", "rgb(255, 255, 255)");
    await fine.evaluate((e) => {
      e.style.color = "transparent";
    });
    // The dev server's indicator badge sits over this corner; it is not the page.
    const ground = (
      await fine.screenshot({ style: "nextjs-portal { display: none; }" })
    ).toString("base64");
    const ratio = await page.evaluate(async (png) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = new OffscreenCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, img.width, img.height).data;
      const lin = (v: number) =>
        (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      let lightest = 0;
      for (let i = 0; i < px.length; i += 4)
        lightest = Math.max(
          lightest,
          0.2126 * lin(px[i]!) +
            0.7152 * lin(px[i + 1]!) +
            0.0722 * lin(px[i + 2]!),
        );
      return 1.05 / (lightest + 0.05);
    }, ground);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

test("at 390 nothing spills sideways and nothing shifts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // CLS on load, from the browser's own layout-shift entries.
  const shift = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        let sum = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[])
            if (!entry.hadRecentInput) sum += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => done(sum), 500);
      }),
  );
  expect(shift).toBeLessThan(0.1);

  await scrollThrough(page);
  expect(await spilledElements(page)).toEqual([]);
});
