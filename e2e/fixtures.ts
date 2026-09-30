import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

type AxeCheck = (page: Page, include?: string) => Promise<void>;

export const test = base.extend<{ expectAxeClean: AxeCheck }>({
  expectAxeClean: async ({}, provide) => {
    await provide(async (page, include) => {
      let axe = new AxeBuilder({ page }).withTags([
        "wcag2a",
        "wcag2aa",
        "wcag21a",
        "wcag21aa",
        "wcag22aa",
      ]);
      if (include) axe = axe.include(include);
      // Mid-fade text reads at part opacity and fails contrast. Nothing in
      // the app loops (DESIGN.md, Motion), so every animation finishes.
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished)),
      );
      const { violations } = await axe.analyze();
      expect(
        violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });
  },
});
