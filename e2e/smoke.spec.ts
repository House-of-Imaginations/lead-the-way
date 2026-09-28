import { expect, test } from "./fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`home renders on tokens with Plex, ${theme} @mobile`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.goto(`/?theme=${theme}`);
    await expect(
      page.getByText("Concept prototype. Not an official IBM product."),
    ).toBeVisible();

    const html = page.locator("html");
    if (theme === "dark")
      await expect(html).toHaveAttribute("data-theme", "dark");
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe(
      theme === "dark" ? "rgb(22, 22, 22)" : "rgb(255, 255, 255)",
    );

    const family = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(family).toMatch(/Plex/i);

    await expectAxeClean(page);
  });
}

test("an unknown route shows the not found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(
    page.getByRole("heading", { name: "We couldn't find that page." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to your home" }),
  ).toHaveAttribute("href", "/");
});
