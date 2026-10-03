import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { TOKENS } from "./components/helpers";
import { resetDemo, signInAs } from "./demo";

const SCHEMES = ["light", "dark"] as const;

const signatures = (page: Page) =>
  page.getByRole("complementary", { name: "Signatures" });
const signButton = (page: Page) =>
  signatures(page).getByRole("button", { name: "Sign the agreement" });

async function openAsDan(page: Page) {
  await signInAs(page, "dan");
  await page.goto("/me/agreement");
}

// Uncaught errors, which would raise the Next dev overlay.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test.describe("at week 1, before Dan signs", () => {
  test.beforeEach(() => resetDemo("week1"));

  test("Dan reads 10 and signs", async ({ page }) => {
    await openAsDan(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Our Team AI Agreement" }),
    ).toBeVisible();
    await expect(
      page.getByText("Client Services team, agreed 7 September 2026"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Microsoft Copilot, ChatGPT Enterprise. Anything else, ask first.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Practise with de-identified or sample data."),
    ).toBeVisible();
    await expect(
      page
        .getByRole("article")
        .getByRole("listitem")
        .filter({ hasText: "Human review before client delivery" }),
    ).toHaveCount(1);
    await expect(page.getByText("Ask Priya Raman.")).toBeVisible();
    await expect(
      page.getByText(
        "Using AI here is normal. Tell us what works, what fails and what you learn.",
      ),
    ).toBeVisible();
    await expect(
      signatures(page).getByText("6 of 7", { exact: true }),
    ).toBeVisible();

    await signButton(page).click();
    await expect(
      page.getByText("Agreement signed", { exact: true }),
    ).toBeVisible();
    await expect(
      signatures(page).getByText("7 of 7", { exact: true }),
    ).toBeVisible();
    await expect(
      signatures(page).getByText("Signed", { exact: true }),
    ).toBeVisible();
    await expect(signButton(page)).toHaveCount(0);

    await page.reload();
    await expect(
      signatures(page).getByText("7 of 7", { exact: true }),
    ).toBeVisible();
    await expect(signButton(page)).toHaveCount(0);
  });

  test("a new version asks Dan to sign again", async ({ page }) => {
    await openAsDan(page);
    await signButton(page).click();
    await expect(
      signatures(page).getByText("7 of 7", { exact: true }),
    ).toBeVisible();

    // Priya changes the agreement: version 2.
    await page.context().clearCookies();
    await signInAs(page, "priya");
    await page.goto("/manager/agreement");
    const tool = page.getByRole("textbox", { name: "Add a tool" });
    await tool.fill("Gemini for Workspace");
    await page
      .locator("form")
      .filter({ has: tool })
      .getByRole("button", { name: "Add" })
      .click();
    await page.getByRole("button", { name: "Save agreement" }).click();
    await expect(
      page.getByText("Agreement saved", { exact: true }),
    ).toBeVisible();

    await page.context().clearCookies();
    await openAsDan(page);
    await expect(page.getByText("Please review and sign.")).toBeVisible();
    await expect(page.getByText(/Gemini for Workspace/)).toBeVisible();
    // Nobody has signed version 2 yet.
    await expect(
      signatures(page).getByText("0 of 7", { exact: true }),
    ).toBeVisible();
    await signButton(page).click();
    await expect(
      signatures(page).getByText("1 of 7", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Please review and sign.")).toHaveCount(0);
  });
});

test.describe("axe", () => {
  test.beforeAll(() => resetDemo("week1"));

  for (const scheme of SCHEMES) {
    test(`10 passes axe, ${scheme}`, async ({ page, expectAxeClean }) => {
      await page.setViewportSize({ width: 1440, height: 1060 });
      await page.emulateMedia({ colorScheme: scheme });
      await openAsDan(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(signatures(page)).toHaveCSS(
        "background-color",
        TOKENS[scheme].layer01,
      );
      // Two columns: the signatures sit beside the agreement.
      const [article, aside] = await Promise.all([
        page.getByRole("article").boundingBox(),
        signatures(page).boundingBox(),
      ]);
      expect(aside!.x).toBeGreaterThan(article!.x + article!.width - 1);
      await expectAxeClean(page);
    });

    test(`10 stacks on a phone and passes axe, ${scheme} @mobile`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await openAsDan(page);
      const [article, aside, button] = await Promise.all([
        page.getByRole("article").boundingBox(),
        signatures(page).boundingBox(),
        signButton(page).boundingBox(),
      ]);
      expect(aside!.y).toBeGreaterThan(article!.y + article!.height - 1);
      expect(button!.height).toBeGreaterThanOrEqual(48);
      await expectAxeClean(page);
    });
  }
});
