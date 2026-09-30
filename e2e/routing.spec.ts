import { expect, test } from "./fixtures";
import { TOKENS } from "./components/helpers";
import { PERSONA, convex, demoPassword, resetDemo, signInAs } from "./demo";

const BANNER =
  "Demo workspace. Calder Lane is sample data for trying Lead the Way. It can be reset at any time.";
const MOVED = "That page is for your team. You're back on your home.";

test("signed out, private pages go to log in and keep where you were going", async ({
  page,
}) => {
  for (const path of [
    "/manager",
    "/me/sprint?week=2",
    "/settings",
    "/workspace/settings",
    "/setup/team",
    "/guide",
    "/home",
  ]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(
      `/login?next=${encodeURIComponent(path)}`,
    );
  }
  for (const path of ["/", "/signup", "/login", "/reset-password"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(path);
  }
});

test("signed in, log in and sign up go home", async ({ page }) => {
  resetDemo("week1");
  await signInAs(page, "priya");
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL("/manager");
  }
});

test("signed in, log in keeps a safe next", async ({ page }) => {
  resetDemo("week1");
  await signInAs(page, "dan");
  await page.goto("/login?next=/me");
  await expect(page).toHaveURL("/me");
  // Dan's /home is /me too, so read the proxy's own answer.
  for (const [next, to] of [
    ["/me", "/me"],
    ["//evil.example", "/home"],
  ]) {
    const res = await page.request.get(
      `/login?next=${encodeURIComponent(next)}`,
      { maxRedirects: 0 },
    );
    expect(res.headers().location, next).toBe(to);
  }
  await page.goto(`/login?next=${encodeURIComponent("//evil.example")}`);
  await expect(page).toHaveURL("/me");
});

test("next never leaves the site", async ({ page, context }) => {
  resetDemo("week1");
  for (const next of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
  ]) {
    await context.clearCookies();
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Work email").fill(PERSONA.priya);
    await page.getByLabel("Password", { exact: true }).fill(demoPassword());
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page, JSON.stringify(next)).toHaveURL(
      "http://localhost:3000/manager",
    );
  }
});

for (const entry of ["/manager", "/login"]) {
  test(`a stale cookie ends at /login, entering at ${entry}`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "not-a-session.signature",
        url: "http://localhost:3000",
      },
    ]);
    await page.goto(entry);
    await expect(page).toHaveURL("/login");
    await expect(
      page.getByRole("heading", { level: 1, name: "Log in to your account" }),
    ).toBeVisible();
    expect(
      (await context.cookies()).some((c) => c.name.includes("session_token")),
    ).toBe(false);
  });
}

test("a role page sends you to your home with a toast", async ({ page }) => {
  resetDemo("week2");
  await signInAs(page, "dan");
  await page.goto("/manager");
  await expect(page).toHaveURL("/me");
  await expect(page.getByText(MOVED, { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await signInAs(page, "priya");
  await page.goto("/me");
  await expect(page).toHaveURL("/manager");
  await expect(page.getByText(MOVED, { exact: true })).toBeVisible();
});

test.describe("setup", () => {
  test.beforeAll(() => resetDemo());

  for (const scheme of ["light", "dark"] as const) {
    test(`Priya at setup reaches /setup/team with the banner, ${scheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await signInAs(page, "priya");
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/home");
      await expect(page).toHaveURL("/setup/team");
      const banner = page
        .getByRole("status")
        .filter({ hasText: "Demo workspace." });
      await expect(banner).toHaveText(BANNER);
      expect((await banner.boundingBox())!.y).toBe(0);
      await expect(banner).toHaveCSS(
        "background-color",
        TOKENS[scheme].highlight,
      );
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Tell us about your team",
        }),
      ).toBeVisible();
      await expect(page.getByText("Set up your team sprint")).toBeVisible();
      const steps = page.getByRole("list", { name: "Sprint setup" });
      await expect(steps.getByRole("listitem")).toHaveText([
        /^Your team\s*2 minutes$/,
        /^Protected hour\s*1 minute$/,
        /^Manager pathway\s*25 minutes$/,
        /^Team agreement\s*30 minutes, with your team$/,
        /^Invite team\s*2 minutes$/,
      ]);
      await expect(steps.getByRole("listitem").first()).toHaveAttribute(
        "aria-current",
        "step",
      );
      await expect(
        page.getByText("Concept prototype. Not an official IBM product."),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(
        0,
      );
      await expectAxeClean(page);
    });
  }

  test("Dan can't open setup", async ({ page }) => {
    resetDemo("week1");
    await signInAs(page, "dan");
    await page.goto("/setup/team");
    await expect(page).toHaveURL("/me");
  });
});

test("an account with no workspace accepts the terms at /setup/start", async ({
  page,
}) => {
  // Signed up through the API, so onboarding.start never ran: the OAuth first-sign-in state.
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Ada Park",
      email: `e2e-start-${Date.now()}@example.com`,
      password: "a long enough password",
    },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
  await page.goto("/home");
  await expect(page).toHaveURL("/setup/start");
  const go = page.getByRole("button", { name: "Continue" });
  await expect(go).toBeDisabled();
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await go.click();
  await expect(page).toHaveURL("/setup/team");
  await expect(page.getByText("Demo workspace.")).toHaveCount(0);
});

test("a closed app sends every page that reads Convex home", async ({
  page,
}) => {
  convex(["env", "set", "APP_CLOSED", "on"]);
  try {
    for (const path of ["/login", "/signup", "/manager"]) {
      // An env change reaches running functions within a few seconds.
      await expect(async () => {
        await page.goto(path);
        await expect(page, path).toHaveURL("/");
      }).toPass({ timeout: 15_000 });
    }
  } finally {
    convex(["env", "remove", "APP_CLOSED"]);
  }
});
