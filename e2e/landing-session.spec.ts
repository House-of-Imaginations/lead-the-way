import { convex, convexUrl, resetDemo, signInAs } from "./demo";
import { expect, test } from "./fixtures";

const SESSION = "/api/auth/get-session";

// Convex traffic is any request to the deployment's host or its `.site` twin.
const CONVEX_HOSTS = (() => {
  const host = new URL(convexUrl()).host;
  return host.endsWith(".convex.cloud")
    ? [host, host.replace(/\.convex\.cloud$/, ".convex.site")]
    : [host];
})();
const isConvex = (url: string) => CONVEX_HOSTS.includes(new URL(url).host);

test.beforeAll(() => resetDemo());

test("signed out, the header offers Log in and Start your sprint", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const header = page.getByRole("banner");
  await expect(
    header.getByRole("link", { name: "Log in", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Start your sprint" }),
  ).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Go to your home" }),
  ).toHaveCount(0);
});

test("signed in, the avatar takes their place and / stays /", async ({
  page,
}) => {
  await signInAs(page, "priya");
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  expect(res?.request().redirectedFrom()).toBeNull();
  await expect(page).toHaveURL("/");

  const header = page.getByRole("banner");
  const home = header.getByRole("link", { name: "Go to your home" });
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute("href", "/home");
  await expect(home).toHaveText("PR");
  await expect(
    header.getByRole("link", { name: "Log in", exact: true }),
  ).toHaveCount(0);
  await expect(
    header.getByRole("link", { name: "Start your sprint" }),
  ).toHaveCount(0);
  await expect(
    header.getByRole("link", { name: "See the prototype" }),
  ).toBeVisible();

  await home.click();
  await page.waitForURL((url) => url.pathname !== "/");
});

test("signed in at 390, the avatar sits by the menu and the menu offers home", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "priya");
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Go to your home" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(
    menu.getByRole("link", { name: "Go to your home" }),
  ).toHaveAttribute("href", "/home");
  await expect(
    menu.getByRole("link", { name: "Log in", exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("link", { name: "Start your sprint" }),
  ).toHaveCount(0);
});

test("the avatar arrives without a console error", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await signInAs(page, "priya");
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Go to your home" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("/ talks to no Convex deployment, signed in or not", async ({ page }) => {
  const convexTraffic: string[] = [];
  page.on("request", (r) => {
    if (isConvex(r.url())) convexTraffic.push(r.url());
  });
  page.on("websocket", (ws) => {
    if (isConvex(ws.url())) convexTraffic.push(ws.url());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await signInAs(page, "priya");
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Go to your home" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(convexTraffic).toEqual([]);
});

test("a closed app shows Log in, never the avatar, and / stays /", async ({
  page,
}) => {
  // Sign in first: a closed app refuses sign-in too.
  await signInAs(page, "priya");
  convex(["env", "set", "APP_CLOSED", "on"]);
  try {
    // An env change reaches running functions within a few seconds.
    await expect(async () => {
      const session = page.waitForResponse((r) => r.url().includes(SESSION));
      await page.goto("/");
      expect((await session).status()).toBe(503);
      await expect(page).toHaveURL("/");
      const header = page.getByRole("banner");
      await expect(
        header.getByRole("link", { name: "Log in", exact: true }),
      ).toBeVisible();
      await expect(
        header.getByRole("link", { name: "Go to your home" }),
      ).toHaveCount(0);
    }).toPass({ timeout: 20_000 });
  } finally {
    convex(["env", "remove", "APP_CLOSED"]);
  }
});
