import { expect, test } from "./fixtures";

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
