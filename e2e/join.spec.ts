import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { TOKENS } from "./components/helpers";
import { convex, resetDemo, signInAs } from "./demo";

const SCHEMES = ["light", "dark"] as const;
const DISCLAIMER = "Concept prototype. Not an official IBM product.";
const ENDED =
  "This invitation is no longer active. Ask Priya Raman for a new one.";
const AI_QUESTION = "How confident do you feel using AI at work?";
const MANAGER_QUESTION =
  "I feel comfortable telling my manager how I use AI at work.";

/**
 * A Calder Lane invitation from Priya, and its token. Made by the seed:
 * demo addresses can't sign up, and the demo holds no open links.
 */
function invite(
  args: { email?: string; status?: "revoked" | "declined" | "accepted" } = {},
): string {
  return JSON.parse(
    convex(["run", "seed:invite", JSON.stringify(args)]),
  ) as string;
}

const fresh = () =>
  `e2e-join-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/** Signed up through the API: an account with no workspace, as a join link meets it. */
async function signUp(page: Page, email: string) {
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Ola Hansen", email, password: "a long enough password" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
}

async function answer(page: Page, question: string, score: number) {
  await page
    .getByRole("group", { name: question })
    .getByRole("radio", { name: String(score), exact: true })
    .check();
}

// Uncaught errors, which would raise the Next dev overlay.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

// Week 1: Priya's sprint is launched and Dan has joined. Every test makes its
// own link, so one reset serves the file.
test.beforeAll(() => resetDemo("week1"));

test("signed out, 09 shows the invitation and where to sign up", async ({
  page,
}) => {
  const token = invite({ email: fresh() });
  await page.goto(`/join/${token}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Priya invited you to From Zero to Hero",
    }),
  ).toBeVisible();
  await expect(page.getByText("Priya Raman, Team manager")).toBeVisible();
  await expect(
    page.getByText(
      "For the next four weeks, one hour of your working week is protected for practical AI learning.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Wednesday, 2:00 to 3:00 PM")).toBeVisible();
  await expect(
    page.getByText(
      "9 to 30 September 2026. Paid work time, already in your calendar.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("15-minute sessions of AI Productivity Fundamentals"),
  ).toBeVisible();
  await expect(
    page.getByText("Share it at the team show and tell on 30 Sep"),
  ).toBeVisible();
  await expect(page.getByText("Your learning stays private.")).toBeVisible();
  const bar = page.getByRole("banner");
  await expect(bar.getByText("Calder Lane")).toBeVisible();
  await expect(bar.getByText(DISCLAIMER)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Join team sprint" }),
  ).toHaveAttribute("href", `/signup?invite=${token}`);
  await expect(
    page.getByRole("main").getByRole("link", { name: "Log in" }),
  ).toHaveAttribute("href", `/login?next=/join/${token}`);
  await expect(
    page.getByRole("link", { name: "View Team AI Agreement" }),
  ).toHaveCount(0);
});

test("Review Focus 1: sign up from the link with the locked address, join, answer, land on /me", async ({
  page,
}) => {
  const email = fresh();
  const token = invite({ email });
  await page.goto(`/join/${token}`);
  await page.getByRole("link", { name: "Join team sprint" }).click();
  await expect(page).toHaveURL(`/signup?invite=${token}`);

  const field = page.getByLabel("Work email");
  await expect(field).toHaveValue(email);
  await expect(field).toHaveAttribute("readonly", "");
  await expect(field).toHaveAccessibleDescription(
    "Your invitation is for this address.",
  );
  await page.getByLabel("Full name").fill("Ola Hansen");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a long enough password");
  await page
    .getByLabel("I agree to the terms of use and privacy notice.")
    .check();
  await page.getByRole("button", { name: "Create account" }).click();

  // Back on the link, ready to join: no workspace of their own was made.
  await expect(page).toHaveURL(`/join/${token}`);
  await page.getByRole("button", { name: "Join team sprint" }).click();

  // The check-in is the page's h1, and focus moves to it from the Join button.
  const title = page.getByRole("heading", {
    level: 1,
    name: "Before you start",
  });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  await expect(
    page.getByText("Two quick questions. Your answers are private to you."),
  ).toBeVisible();
  const save = page.getByRole("button", { name: "Save answers" });
  await expect(save).toBeDisabled();
  await expect(save).toHaveAccessibleDescription(
    "Pick a number for both questions to save.",
  );
  await expect(
    page.getByText("Pick a number for both questions to save."),
  ).toBeVisible();
  await answer(page, AI_QUESTION, 4);
  await answer(page, MANAGER_QUESTION, 3);
  await save.click();

  await expect(page).toHaveURL("/me");
  // Seated in Calder Lane, the demo workspace.
  await expect(page.getByText("Demo workspace.")).toBeVisible();
});

test("Skip for now joins without answers", async ({ page }) => {
  const email = fresh();
  const token = invite({ email });
  await signUp(page, email);
  await page.goto(`/join/${token}`);
  await page.getByRole("button", { name: "Join team sprint" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page).toHaveURL("/me");
});

test("a link for another address says so, and Log out signs out", async ({
  page,
}) => {
  await signUp(page, fresh());
  const token = invite({ email: fresh() });
  await page.goto(`/join/${token}`);
  await expect(
    page.getByText(
      "This invitation is for a different email address. Log out, then open the link again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Join team sprint" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(
    page.getByRole("link", { name: "Join team sprint" }),
  ).toBeVisible();
});

test("Dan is already in Calder Lane", async ({ page }) => {
  await signInAs(page, "dan");
  await page.goto(`/join/${invite()}`);
  await expect(page.getByText("You're already in Calder Lane.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to your home" }),
  ).toHaveAttribute("href", "/home");
  await expect(
    page.getByRole("link", { name: "View Team AI Agreement" }),
  ).toHaveAttribute("href", "/me/agreement");
  await expect(page.getByRole("banner").getByText("Dan Okafor")).toBeVisible();
});

for (const status of ["revoked", "declined", "accepted"] as const) {
  test(`a ${status} link is no longer active`, async ({ page }) => {
    await signInAs(page, "dan");
    await page.goto(`/join/${invite({ status })}`);
    await expect(page.getByText(ENDED)).toBeVisible();
    await expect(page.getByRole("button", { name: /join/i })).toHaveCount(0);
  });
}

test("an unknown link isn't valid, signed out or in", async ({ page }) => {
  for (const signIn of [false, true]) {
    if (signIn) await signInAs(page, "dan");
    await page.goto("/join/not-a-real-token");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "This invitation link isn't valid.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Ask your manager for a new one."),
    ).toBeVisible();
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
  }
});

test("/join/preview shows Priya the team's view, and only Priya", async ({
  page,
}) => {
  await signInAs(page, "priya");
  await page.goto("/join/preview");
  await expect(
    page.getByRole("banner").getByText("Preview", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Priya invited you to From Zero to Hero",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Join team sprint" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "View Team AI Agreement" }),
  ).toBeDisabled();
  await expect(
    page.getByText("This is how your team sees the invitation."),
  ).toBeVisible();

  await page.context().clearCookies();
  await signInAs(page, "dan");
  await page.goto("/join/preview");
  await expect(page).toHaveURL("/me");
});

test("/join/preview, signed in with no seat, lands on a home and doesn't loop", async ({
  page,
}) => {
  await signUp(page, fresh());
  await page.goto("/join/preview");
  await expect(page).not.toHaveURL(/\/login|\/join\/preview/);

  await page.context().clearCookies();
  await page.goto("/join/preview");
  await expect(page).toHaveURL("/login?next=%2Fjoin%2Fpreview");
});

test("M1: on a phone the invitation stacks and the actions come last @mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`/join/${invite({ email: fresh() })}`);
  const title = page.getByRole("heading", { level: 1 });
  const hour = page.getByText("Wednesday, 2:00 to 3:00 PM");
  const privacy = page.getByText(
    "Your SkillsBuild activity is private. Priya sees only team totals and what you choose to share.",
  );
  const join = page.getByRole("link", { name: "Join team sprint" });
  await expect(privacy).toBeVisible();
  const [t, h, p, j] = await Promise.all(
    [title, hour, privacy, join].map((l) => l.boundingBox()),
  );
  expect(h!.y).toBeGreaterThan(t!.y);
  expect(p!.y).toBeGreaterThan(h!.y);
  expect(j!.y).toBeGreaterThan(p!.y);
  // Full width inside 16px gutters, and a 48px touch target.
  expect(j!.width).toBeGreaterThanOrEqual(390 - 32 - 1);
  expect(j!.height).toBeGreaterThanOrEqual(48);
  // The quote is desktop only (M1).
  await expect(page.getByRole("figure")).toBeHidden();
});

for (const scheme of SCHEMES) {
  test(`09 and the before check-in pass axe, ${scheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const email = fresh();
    const token = invite({ email });
    await page.goto(`/join/${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      TOKENS[scheme].background,
    );
    await expectAxeClean(page);

    await signUp(page, email);
    await page.reload();
    await page.getByRole("button", { name: "Join team sprint" }).click();
    await expect(
      page.getByRole("heading", { name: "Before you start" }),
    ).toBeVisible();
    await expectAxeClean(page);
  });

  test(`M1 passes axe, ${scheme} @mobile`, async ({ page, expectAxeClean }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(`/join/${invite({ email: fresh() })}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectAxeClean(page);
  });
}
