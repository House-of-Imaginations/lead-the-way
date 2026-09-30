import { expect, test } from "../fixtures";
import { THEMES, TOKENS, gallery } from "./helpers";

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
      await expect(joined.locator(".ltw-stat-v")).toHaveText("7 of 8");
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

    test("the tag dismiss button has a 48px hit area on phones @mobile", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const remove = page
        .locator("#status")
        .getByRole("button", { name: "Remove Copilot" });
      await remove.scrollIntoViewIfNeeded();
      const box = (await remove.boundingBox())!;
      // 16px above the 16px button's centre: outside the button, inside a 48px target.
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2 - 16;
      expect(
        await remove.evaluate(
          (el, [px, py]) => el.contains(document.elementFromPoint(px, py)),
          [x, y],
        ),
      ).toBe(true);
    });

    test("status components pass axe", async ({ page, expectAxeClean }) => {
      await expectAxeClean(page, "#status");
    });
  });
}

for (const theme of THEMES) {
  test(`the demo banner is a flat status strip, ${theme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.goto(gallery(theme));
    const banner = page
      .locator("#status")
      .getByRole("status")
      .filter({ hasText: "Demo workspace." });
    await expect(banner).toHaveText(
      "Demo workspace. Calder Lane is sample data for trying Lead the Way. It can be reset at any time.",
    );
    await expect(banner).toHaveCSS("background-color", TOKENS[theme].highlight);
    await expect(banner).toHaveCSS(
      "border-bottom",
      `1px solid ${TOKENS[theme].borderSubtle}`,
    );
    await expect(banner).toHaveCSS("border-radius", "0px");
    await expect(banner).toHaveCSS("box-shadow", "none");
    await expect(banner).toHaveCSS("height", "32px");
    await expect(banner.locator("strong")).toHaveCSS("font-weight", "600");
    await expect(banner.locator("svg")).toHaveAttribute("width", "16");
    await expect(banner.locator("a, button, [tabindex]")).toHaveCount(0);
    await expectAxeClean(page, "#status");
  });
}

test("the demo banner is at least 48px high on a phone @mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(gallery("light"));
  const banner = page
    .locator("#status")
    .getByRole("status")
    .filter({ hasText: "Demo workspace." });
  expect((await banner.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});
