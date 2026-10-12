import { expect, test } from "./fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`home renders on tokens with Plex, ${theme} @mobile`, async ({
    page,
    expectAxeClean,
  }) => {
    // R14: GSAP tweens are not Web Animations, so the axe fixture cannot wait
    // for them; with motion reduced none run.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/?theme=${theme}`);
    // The menu repeats the disclaimer; the footer's is the one always shown.
    await expect(
      page
        .getByRole("contentinfo")
        .getByText("Concept prototype. Not an official IBM product."),
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
