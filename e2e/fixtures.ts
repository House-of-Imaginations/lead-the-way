import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

export const test = base.extend<{
  expectAxeClean: (page: Page) => Promise<void>;
}>({
  expectAxeClean: async ({}, provide) => {
    await provide(async (page) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    });
  },
});
