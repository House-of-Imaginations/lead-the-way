import { expect, test } from "./fixtures";

const PATH = "/demo/partner-email";
const DISCLAIMER = "Concept prototype. Not an official IBM product.";

/** screens.md "01", each line the whole text of one element. */
const COPY = [
  "Inbox",
  DISCLAIMER,
  "Lead your team into AI. Free, 4 weeks, with SkillsBuild.",
  "From",
  "Southbank Business Collective <programs@southbankcollective.org.au>",
  "To",
  "Priya Raman",
  "Date",
  "Tuesday 1 September 2026, 9:12 AM",
  "SB",
  "Southbank Business Collective",
  "Member program",
  "Hi Priya,",
  "As a member, your team can join From Zero to Hero: a free four-week AI sprint for managers and their teams, built on existing IBM SkillsBuild courses.",
  "It starts with you. You get a short manager path, a ready-made Team AI Agreement, and a plan to protect one working hour a week, so your team learns during work instead of after it.",
  "60 min",
  "Leading AI in Your Team: safe use, checking outputs, supporting nervous learners",
  "30 min",
  "One team conversation that ends with four shared AI rules",
  "4 x 1 hr",
  "A protected weekly hour to learn, apply it to real work and show what changed",
  "Participation is voluntary and uses paid work time. Learning data is never used for performance review.",
];

test("partner email renders signed out", async ({ page }) => {
  // Ruling 15: static. The dev server's own HMR socket lives under /_next/.
  const sockets: string[] = [];
  page.on("websocket", (ws) => {
    if (!ws.url().includes("/_next/")) sockets.push(ws.url());
  });
  const auth: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/auth/")) auth.push(r.url());
  });
  await page.goto(PATH);
  await expect(page).toHaveURL(PATH);
  await expect(page).toHaveTitle("Partner email · From Zero to Hero");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Lead your team into AI" }),
  ).toBeVisible();
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(sockets).toEqual([]);
  expect(auth).toEqual([]);
});

test("the call to action is sentence case and goes to /", async ({ page }) => {
  await page.goto(PATH);
  const cta = page.getByRole("link", {
    name: "Start the manager path",
    exact: true,
  });
  await expect(cta).toHaveCount(1);
  await expect(cta).toHaveAttribute("href", "/");
  await expect(
    page.getByText("Start the Manager Path", { exact: true }),
  ).toHaveCount(0);
  await cta.click();
  await expect(page).toHaveURL("/");
});

test("partner email matches the wireframe copy", async ({ page }) => {
  await page.goto(PATH);
  for (const text of COPY) {
    await expect(page.getByText(text, { exact: true }), text).toBeVisible();
  }
  await expect(
    page.getByText(
      /^Sent by Southbank Business Collective on behalf of the SkillsBuild partner program\. Unsubscribe$/,
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Unsubscribe" })).toHaveAttribute(
    "href",
    "/",
  );
});

for (const scheme of ["light", "dark"] as const) {
  test(`partner email passes axe, ${scheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1180 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(PATH);
    await expectAxeClean(page);
    // For the wireframe review (Step 5). output/ is git-ignored.
    await page.screenshot({
      path: `output/screens/01-${scheme}.png`,
      fullPage: true,
    });
  });
}
