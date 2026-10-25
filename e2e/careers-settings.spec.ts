import { LOOKS, look, resetCareers } from "./careers";
import { E2E_DOMAIN, seedCareer, signInAs } from "./demo";
import { expect, test } from "./fixtures";

// D8 Privacy and settings (`/careers/settings`): Amara's partner track.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => resetCareers());

for (const { width, colorScheme } of LOOKS) {
  test(`settings at ${width}, ${colorScheme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await look(page, width, colorScheme);
    await signInAs(page, "amara");
    await page.goto("/careers/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Privacy and settings" }),
    ).toBeVisible();
    // Opens on Privacy.
    await expect(page.getByRole("tab", { name: "Privacy" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    for (const [name, on] of [
      ["Show “done this week” to my crew", "true"],
      ["Let my guide see lesson progress", "true"],
      ["Show my reflection on shared proof links", "true"],
      ["Include my answers in anonymous research", "false"],
    ] as const)
      await expect(page.getByRole("switch", { name })).toHaveAttribute(
        "aria-checked",
        on,
      );
    await expect(
      page.getByText("Lena uses it to plan check-ins."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No employer ever sees" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete my answers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete this track" }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Concept prototype. Not an official IBM product.")
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expectAxeClean(page);
  });
}

test("a switch saves at once and stays saved", async ({ page }) => {
  await look(page, 1440, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/settings");
  const research = page.getByRole("switch", {
    name: "Include my answers in anonymous research",
  });
  await research.click();
  await expect(page.getByText("Setting saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(research).toHaveAttribute("aria-checked", "true");
  await research.click();
  await expect(research).toHaveAttribute("aria-checked", "false");
});

test("reminders and profile tabs", async ({ page, expectAxeClean }) => {
  await look(page, 1440, "dark");
  await signInAs(page, "amara");
  await page.goto("/careers/settings");
  await page.getByRole("tab", { name: "Reminders" }).click();
  await expect(
    page.getByRole("switch", { name: "Send a Sunday summary" }),
  ).toBeVisible();
  await expectAxeClean(page);
  await page.getByRole("tab", { name: "Profile" }).click();
  // A partner track has no separate contact address.
  await expect(
    page.getByText("We contact you at the address you log in with."),
  ).toBeVisible();
});

test("delete my answers asks in the page, then keeps the badges", async ({
  page,
}) => {
  await look(page, 390, "light");
  await signInAs(page, "amara");
  await page.goto("/careers/settings");
  await page.getByRole("button", { name: "Delete my answers" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Delete my answers" }).click();
  await page.getByRole("button", { name: "Delete answers" }).click();
  await expect(page.getByText("Answers deleted.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("You have no answers saved.")).toBeVisible();
});

test("a private track edits its contact email, then deletes the track", async ({
  page,
}) => {
  await look(page, 1440, "light");
  const email = `e2e-d8-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Kai Moreno", email, password: "a long enough password" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
  seedCareer(email);
  // A career-only account's /settings is the career track's.
  await page.goto("/settings");
  await expect(page).toHaveURL("/careers/settings");
  await page.getByRole("tab", { name: "Profile" }).click();
  const field = page.getByLabel("Contact email");
  await field.fill(email);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Use a personal address, not the one you log in with."),
  ).toBeVisible();
  await field.fill("kai@home.example");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Profile" }).click();
  await expect(field).toHaveValue("kai@home.example");

  await page.getByRole("tab", { name: "Privacy" }).click();
  await page.getByRole("button", { name: "Delete this track" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Delete your Change careers track?",
  });
  await dialog.getByRole("button", { name: "Delete track" }).click();
  await expect(page).not.toHaveURL(/\/careers\//);
});
