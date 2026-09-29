import { expect, test } from "../fixtures";
import { THEMES, TOKENS, expectedRing, focusRing, gallery } from "./helpers";

for (const theme of THEMES) {
  test.describe(`choices, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(gallery(theme));
    });

    test("the pressed content switcher segment shows the focus ring", async ({
      page,
    }) => {
      // The selected segment is filled with layer-inverse: the other surface a single ring vanishes on.
      const pressed = page
        .locator("#choices")
        .getByRole("button", { name: "Wed", pressed: true });
      expect(await focusRing(pressed)).toEqual(expectedRing(theme));
    });

    test("the toggle shows the focus ring", async ({ page }) => {
      const toggle = page.locator("#choices").getByRole("switch", {
        name: "Weekly reminder before the protected hour",
      });
      expect(await focusRing(toggle)).toEqual(expectedRing(theme));
    });

    test("a focused Likert radio rings its box", async ({ page }) => {
      const radio = page
        .locator("#choices")
        .getByRole("radio", { name: "3", exact: true });
      await radio.focus();
      const ring = await radio.evaluate((el) => {
        const s = getComputedStyle(el.nextElementSibling!);
        return {
          outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
          offset: s.outlineOffset,
          boxShadow: s.boxShadow,
        };
      });
      const { outline, offset, boxShadow } = expectedRing(theme);
      expect(ring).toEqual({ outline, offset, boxShadow });
    });

    test("a toggle is a switch that applies at once", async ({ page }) => {
      const toggle = page.locator("#choices").getByRole("switch", {
        name: "Weekly reminder before the protected hour",
      });
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await expect(toggle).toHaveAccessibleDescription(
        "An email the day before, at 9:00 AM.",
      );
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(toggle).toHaveCSS(
        "background-color",
        TOKENS[theme].supportSuccess,
      );
      await toggle.press("Space");
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await expect(
        page
          .locator("#choices")
          .getByRole("switch", { name: "Show and tell reminder" }),
      ).toBeDisabled();
    });

    test("a content switcher keeps exactly one segment pressed", async ({
      page,
    }) => {
      const group = page
        .locator("#choices")
        .getByRole("group", { name: "Default learning day" });
      await group.getByRole("button", { name: "Fri" }).click();
      await expect(group.getByRole("button", { name: "Fri" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(group.getByRole("button", { pressed: true })).toHaveCount(1);
      await group.getByRole("button", { name: "Mon" }).press("Enter");
      await expect(group.getByRole("button", { name: "Mon" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    test("the content switcher hugs its buttons", async ({ page }) => {
      const cs = page.locator("#choices .ltw-cs");
      const widths = await cs.evaluate((el) => ({
        own: el.getBoundingClientRect().width,
        buttons: [...el.querySelectorAll("button")].reduce(
          (sum, b) => sum + b.getBoundingClientRect().width,
          0,
        ),
        border: parseFloat(getComputedStyle(el).borderLeftWidth) * 2,
      }));
      expect(
        Math.abs(widths.own - widths.border - widths.buttons),
      ).toBeLessThanOrEqual(1);
    });

    test("the content switcher spans its parent on phones @mobile", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const cs = page.locator("#choices .ltw-cs");
      const m = await cs.evaluate((el) => {
        const parent = el.parentElement!;
        const ps = getComputedStyle(parent);
        return {
          own: el.getBoundingClientRect().width,
          content:
            parent.clientWidth -
            parseFloat(ps.paddingLeft) -
            parseFloat(ps.paddingRight),
          fits: el.scrollWidth <= el.clientWidth,
        };
      });
      expect(Math.abs(m.own - m.content)).toBeLessThanOrEqual(1);
      expect(m.fits).toBe(true);
    });

    test("a selectable tile toggles and shows a check @mobile", async ({
      page,
    }) => {
      const tile = page
        .locator("#choices")
        .getByRole("button", { name: /Reporting and drafting/ });
      await expect(tile).toHaveAttribute("aria-pressed", "false");
      await tile.click();
      await expect(tile).toHaveAttribute("aria-pressed", "true");
      await expect(tile.locator(".ltw-tile-check")).toBeVisible();
      await tile.click();
      await expect(tile).toHaveAttribute("aria-pressed", "false");
    });

    test("the likert scale is a radio group with named ends @mobile", async ({
      page,
    }) => {
      const scale = page.locator("#choices").getByRole("group", {
        name: "How confident do you feel using AI at work?",
      });
      await expect(
        scale.getByRole("radio", { name: "1, Not confident" }),
      ).toBeVisible();
      await expect(
        scale.getByRole("radio", { name: "5, Very confident" }),
      ).toBeVisible();
      await scale.getByRole("radio", { name: "3" }).check();
      await scale.getByRole("radio", { name: "3" }).press("ArrowRight");
      await expect(scale.getByRole("radio", { name: "4" })).toBeChecked();
      await expect(scale.locator(".ltw-lk-o span").nth(3)).toHaveCSS(
        "height",
        "48px",
      );
    });

    test("choices pass axe", async ({ page, expectAxeClean }) => {
      await expectAxeClean(page, "#choices");
    });
  });
}
