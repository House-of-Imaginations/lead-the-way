import { expect, test } from "./fixtures";
import { TOKENS } from "./components/helpers";
import { PERSONA, convex, demoPassword, resetDemo } from "./demo";

const SCHEMES = ["light", "dark"] as const;
const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const PROVIDERS = [
  ["google", "Google"],
  ["github", "GitHub"],
  ["discord", "Discord"],
] as const;

test.describe("sign up", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("reads as 02a, without a demo banner", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeVisible();
    await expect(
      page.getByText("Set up a four-week AI sprint for your team."),
    ).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Work email")).toHaveAccessibleDescription(
      "Use your work address so your team can find you.",
    );
    await expect(
      page.getByLabel("Password", { exact: true }),
    ).toHaveAccessibleDescription(
      "At least 12 characters. A short phrase works well.",
    );
    await expect(
      page.getByRole("button", { name: "Sign up with single sign-on" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(
      page.getByRole("link", { name: "Lead the Way" }),
    ).toHaveAttribute("href", "/");
    await expect(
      page.getByRole("heading", { name: "Start with one hour a week." }),
    ).toBeVisible();
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
    await expect(page.getByText("Demo workspace.")).toHaveCount(0);
  });

  test("the terms box gates Create account", async ({ page }) => {
    const create = page.getByRole("button", { name: "Create account" });
    await expect(create).toBeDisabled();
    await page
      .getByLabel("I agree to the terms of use and privacy notice.")
      .check();
    await expect(create).toBeEnabled();
  });

  test("the password can be shown and hidden", async ({ page }) => {
    const password = page.getByLabel("Password", { exact: true });
    const show = page.getByRole("button", { name: "Show password" });
    await password.fill("a phrase to see");
    await expect(show).toHaveAttribute("aria-pressed", "false");
    await show.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(show).toHaveAttribute("aria-pressed", "true");
  });

  test("a short password says how to fix it", async ({ page }) => {
    await page.getByLabel("Full name").fill("Sam Lee");
    await page.getByLabel("Work email").fill("sam@example.com");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("too short");
    await page
      .getByLabel("I agree to the terms of use and privacy notice.")
      .check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAccessibleDescription(
      /Use at least 12 characters\./,
    );
    await expect(page).toHaveURL("/signup");
  });

  test("a demo address can't sign up", async ({ page }) => {
    await page.getByLabel("Full name").fill("Priya Raman");
    await page.getByLabel("Work email").fill(PERSONA.priya);
    await page
      .getByLabel("Password", { exact: true })
      .fill("a long enough password");
    await page
      .getByLabel("I agree to the terms of use and privacy notice.")
      .check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText(
        "Demo accounts are made by the seed. Use the persona switch.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL("/signup");
  });

  test("a new account goes to setup, and ?ref changes nothing", async ({
    page,
  }) => {
    // R8: ?ref is display-only. The account gets its own workspace, not Calder Lane.
    await page.goto("/signup?ref=calder-lane");
    await page.getByLabel("Full name").fill("Sam Lee");
    await page.getByLabel("Work email").fill(`e2e-${Date.now()}@example.com`);
    await page
      .getByLabel("Password", { exact: true })
      .fill("a long enough password");
    await page
      .getByLabel("I agree to the terms of use and privacy notice.")
      .check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/setup/team");
  });

  test("single sign-on explains itself and Use email goes to the email field", async ({
    page,
  }) => {
    const trigger = page.getByRole("button", {
      name: "Sign up with single sign-on",
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Single sign-on isn't set up",
    });
    await expect(dialog).toHaveAccessibleDescription(
      "Single sign-on is not set up for this demo workspace. Use your work email and password instead.",
    );
    await expect(
      dialog.getByRole("button", { name: "Use email" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole("button", { name: "Use email" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Work email")).toBeFocused();
  });
});

test.describe("log in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("reads as 02b, without a demo banner", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Log in to your account" }),
    ).toBeVisible();
    await expect(
      page.getByText("Enter your work email to continue your sprint."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log in with single sign-on" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup",
    );
    await expect(
      page.getByRole("heading", {
        name: "Learning that fits inside the working week.",
      }),
    ).toBeVisible();
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
    await expect(page.getByText("Demo workspace.")).toHaveCount(0);
  });

  test("a wrong password and an unknown email get one neutral message under the password", async ({
    page,
  }) => {
    const email = page.getByLabel("Work email");
    const password = page.getByLabel("Password", { exact: true });
    const logIn = page.getByRole("button", { name: "Log in", exact: true });
    const message = page.getByText(
      "Check your email and password and try again.",
    );

    await email.fill(PERSONA.priya);
    await password.fill("not the password at all");
    await logIn.click();
    await expect(message).toHaveCount(1);
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(email).not.toHaveAttribute("aria-invalid", "true");

    await email.fill(`nobody-${Date.now()}@example.com`);
    await logIn.click();
    await expect(message).toHaveCount(1);
    await expect(page).toHaveURL("/login");
  });

  test("Priya logs in and lands on her home, or on next", async ({ page }) => {
    resetDemo("week1");
    await page.getByLabel("Work email").fill(PERSONA.priya);
    await page.getByLabel("Password", { exact: true }).fill(demoPassword());
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL("/manager");

    await page.context().clearCookies();
    await page.goto("/login?next=/manager/outcomes");
    await page.getByLabel("Work email").fill(PERSONA.priya);
    await page.getByLabel("Password", { exact: true }).fill(demoPassword());
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL("/manager/outcomes");
  });
});

test("social buttons match the providers Convex has on", async ({ page }) => {
  const on = JSON.parse(convex(["run", "authMethods:enabled"])) as string[];
  for (const path of ["/signup", "/login"]) {
    await page.goto(path);
    for (const [key, name] of PROVIDERS) {
      await expect(
        page.getByRole("button", { name: `Continue with ${name}` }),
      ).toHaveCount(on.includes(key) ? 1 : 0);
    }
  }
});

for (const scheme of SCHEMES) {
  for (const path of ["/signup", "/login"]) {
    test(`${path} is on tokens and passes axe, ${scheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        TOKENS[scheme].background,
      );
      await expect(page.getByRole("complementary")).toHaveCSS(
        "background-color",
        TOKENS[scheme].layer01,
      );
      await expectAxeClean(page);
    });
  }
}

test("below 1024px the panel hides and the form fills the width @mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Start with one hour a week." }),
  ).toBeHidden();
  const create = (await page
    .getByRole("button", { name: "Create account" })
    .boundingBox())!;
  expect(create.width).toBeGreaterThanOrEqual(390 - 2 * 16 - 1);
  expect(create.height).toBeGreaterThanOrEqual(48);
});

// Group C carry: a field's label action ("Forgot your password?" on 02b) is a
// 48px touch target on phones, checked on the real /login control.
test("a label action is a 48px touch target on phones @mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const forgot = (await page
    .getByRole("button", { name: "Forgot your password?" })
    .boundingBox())!;
  expect(forgot.height).toBeGreaterThanOrEqual(48);
  expect(forgot.width).toBeGreaterThanOrEqual(48);
});
