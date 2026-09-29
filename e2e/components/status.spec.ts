import { expect, test } from "../fixtures";
import { THEMES, gallery } from "./helpers";

const TAGS = {
  light: {
    gray: "rgb(224, 224, 224)",
    blue: "rgb(208, 226, 255)",
    green: "rgb(167, 240, 186)",
  },
  dark: {
    gray: "rgb(82, 82, 82)",
    blue: "rgb(0, 45, 156)",
    green: "rgb(4, 67, 23)",
  },
} as const;

for (const theme of THEMES) {
  test.describe(`status components, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("tags are the only rounded shape and colour by meaning", async ({
      page,
    }) => {
      const status = page.locator("#status");
      for (const [text, color] of [
        ["Draft", "gray"],
        ["Active", "blue"],
        ["Completed", "green"],
      ] as const) {
        const tag = status.locator(".ltw-tag", { hasText: text });
        await expect(tag).toHaveCSS("background-color", TAGS[theme][color]);
        await expect(tag).toHaveCSS("border-radius", "24px");
      }
    });

    test("a dismissible tag removes itself", async ({ page }) => {
      const status = page.locator("#status");
      await status.getByRole("button", { name: "Remove Copilot" }).click();
      await expect(
        status.locator(".ltw-tag", { hasText: "Copilot" }),
      ).toHaveCount(0);
      await expect(
        status.locator(".ltw-tag", { hasText: "Gemini" }),
      ).toBeVisible();
    });

    test("avatars are square, 32px and hidden from assistive tech", async ({
      page,
    }) => {
      const avatar = page.locator("#status .ltw-av").first();
      await expect(avatar).toHaveText("PR");
      await expect(avatar).toHaveCSS("width", "32px");
      await expect(avatar).toHaveCSS("border-radius", "0px");
      await expect(avatar).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator("#status .ltw-av-org")).toHaveText("CL");
    });

    test("notifications lead with bold words", async ({ page }) => {
      const status = page.locator("#status");
      const info = status.locator(".ltw-ntf", {
        hasText: "Aggregate progress only.",
      });
      await expect(info.locator("b")).toHaveText("Aggregate progress only.");
      await expect(info).toContainText(
        "Individual course activity remains private.",
      );
      await expect(status.locator(".ltw-ntf-success")).toContainText("Saved.");
    });

    test("stat tiles show one light number, and hidden totals say why", async ({
      page,
    }) => {
      const status = page.locator("#status");
      const joined = status.locator(".ltw-stat", {
        hasText: "Joined the sprint",
      });
      await expect(joined.locator(".ltw-stat-v")).toHaveText("7of 8");
      await expect(joined.locator(".ltw-stat-v")).toHaveCSS(
        "font-weight",
        "300",
      );
      const hidden = status.locator(".ltw-stat", { hasText: "Confidence" });
      await expect(hidden.locator(".ltw-stat-v")).toHaveText("Hidden");
      await expect(hidden).toContainText("Hidden until 5 responses");
    });

    test("skeletons are static and hidden from assistive tech", async ({
      page,
    }) => {
      const skeleton = page
        .getByTestId("skeleton")
        .locator(".ltw-skel")
        .first();
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
      await expect(skeleton).toHaveCSS("animation-name", "none");
    });

    test("status components pass axe", async ({ page, expectAxeClean }) => {
      await expectAxeClean(page, "#status");
    });
  });
}
