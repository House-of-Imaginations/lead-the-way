import { expect, test } from "./fixtures";
import { TOKENS } from "./components/helpers";
import { PERSONA } from "./demo";

const SENT =
  "Check your email. If an account exists for that address, we sent a reset link.";
const EXPIRED = "This reset link has expired or was already used.";

test("forgot password asks for the email first, then answers the same for anyone", async ({
  page,
}) => {
  await page.goto("/login");
  const email = page.getByLabel("Work email");
  const forgot = page.getByRole("button", { name: "Forgot your password?" });

  await forgot.click();
  await expect(email).toHaveAccessibleDescription(
    "Enter your work email first.",
  );
  await expect(email).toHaveAttribute("aria-invalid", "true");

  await email.fill(`nobody-${Date.now()}@example.com`);
  await forgot.click();
  await expect(page.getByRole("status")).toHaveText(SENT);
  await expect(email).not.toHaveAttribute("aria-invalid", "true");

  await page.reload();
  await page.getByLabel("Work email").fill(PERSONA.priya);
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("status")).toHaveText(SENT);
});

test("the forgot action sits on the password label's row", async ({ page }) => {
  await page.goto("/login");
  const forgot = (await page
    .getByRole("button", { name: "Forgot your password?" })
    .boundingBox())!;
  const label = (await page
    .locator('label[for="login-password"]')
    .boundingBox())!;
  expect(Math.abs(forgot.y - label.y)).toBeLessThan(4);
});

for (const url of ["/reset-password", "/reset-password?error=INVALID_TOKEN"]) {
  test(`a missing or refused token says so: ${url}`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByText(EXPIRED)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Get a new link" }),
    ).toHaveAttribute("href", "/login");
    await expect(page.getByLabel("New password")).toHaveCount(0);
  });
}

test("a token Better Auth rejects says so after Save password", async ({
  page,
}) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose a new password" }),
  ).toBeVisible();
  const password = page.getByLabel("New password");
  await password.fill("short");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(password).toHaveAccessibleDescription(
    /Use at least 12 characters\./,
  );

  await password.fill("a long enough new password");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText(EXPIRED)).toBeVisible();
});

test("after a reset, log in confirms the new password", async ({ page }) => {
  await page.goto("/login?reset=1");
  await expect(page.getByRole("status")).toHaveText(
    "Password saved. Log in with your new password.",
  );
});

for (const scheme of ["light", "dark"] as const) {
  test(`reset and forgot pass axe, ${scheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/reset-password?token=not-a-real-token");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      TOKENS[scheme].background,
    );
    await expectAxeClean(page);

    await page.goto("/login");
    await page.getByLabel("Work email").fill("sam@example.com");
    await page.getByRole("button", { name: "Forgot your password?" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await expectAxeClean(page);
  });
}
