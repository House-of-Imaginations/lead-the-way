import { expect, test } from "../fixtures";
import { THEMES, TOKENS, gallery } from "./helpers";

for (const theme of THEMES) {
  test(`track tiles are one choice and show the selected outline, ${theme}`, async ({
    page,
  }) => {
    await page.goto(gallery(theme));
    const group = page
      .locator("#tracks")
      .getByRole("group", { name: "Choose a track" });
    const teamRadio = group.getByRole("radio", { name: "Grow in my role" });
    const careerRadio = group.getByRole("radio", { name: "Change careers" });
    // The label is what people click; the hidden radio holds the state.
    const team = group.locator("label", { hasText: "Grow in my role" });
    const career = group.locator("label", { hasText: "Change careers" });
    await expect(teamRadio).not.toBeChecked();
    await expect(careerRadio).not.toBeChecked();

    await team.click();
    await expect(teamRadio).toBeChecked();
    await expect(careerRadio).not.toBeChecked();
    await career.click();
    await expect(careerRadio).toBeChecked();
    await expect(teamRadio).not.toBeChecked();
    await team.click();
    // border-inverse has the same value as text-primary in both themes.
    await expect(team).toHaveCSS("outline-color", TOKENS[theme].textPrimary);
    await expect(team).toHaveCSS("border-radius", "0px");
    await expect(team.locator(".ltw-tag")).toHaveCSS(
      "background-color",
      TOKENS[theme].tagPurpleBg,
    );
    await expect(team.locator("svg").first()).toHaveCSS("width", "20px");
    // 0, not the tile's inherited 0.16px: Chrome reports a zero as "normal".
    await expect(team.locator(".ltw-track-title")).toHaveCSS(
      "letter-spacing",
      "normal",
    );
  });

  test(`the track switcher marks the selected row, ${theme}`, async ({
    page,
  }) => {
    await page.goto(gallery(theme));
    const group = page
      .locator("#tracks")
      .getByRole("group", { name: "Your tracks" });
    await expect(group.getByRole("link")).toHaveCount(2);
    const team = group.getByRole("link", { name: "Team sprint" });
    const career = group.getByRole("link", { name: "Change careers" });
    await expect(team).toHaveAttribute("aria-current", "true");
    await expect(team).toHaveCSS("background-color", TOKENS[theme].layer01);
    await expect(career).not.toHaveAttribute("aria-current");
    await expect(career).toHaveAttribute("href", "/careers/journey");
  });

  test(`in the rail only the squares remain, ${theme}`, async ({
    page,
    context,
    expectAxeClean,
  }) => {
    await context.clearCookies();
    await page.goto(gallery(theme));
    const nav = page
      .locator("#sidenav-tracks")
      .getByRole("navigation", { name: "Main" });
    await nav.getByRole("button", { name: "Collapse" }).click();
    await expect(nav).toHaveCSS("width", "48px");

    const links = nav
      .getByRole("group", { name: "Your tracks" })
      .getByRole("link");
    await expect(links).toHaveCount(2);
    for (const text of [
      "Team sprint",
      "Calder Lane, week 2 of 4",
      "Change careers",
      "Private",
    ]) {
      await expect(nav.getByText(text, { exact: true })).toBeHidden();
    }
    await expect(links.nth(0)).toHaveAttribute(
      "title",
      "Team sprint, Calder Lane, week 2 of 4",
    );
    await expect(links.nth(1)).toHaveAttribute(
      "title",
      "Change careers, Private",
    );
    const square = nav
      .locator('.ltw-sn-tr[aria-current="true"] > span')
      .first();
    await expect(square).toHaveCSS("outline-style", "solid");
    await expect(square).toHaveCSS("outline-width", "2px");
    await expect(square).toHaveCSS("outline-color", TOKENS[theme].interactive);
    await expectAxeClean(page, "#sidenav-tracks");
  });

  test(`who sees what is a table, ${theme}`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.goto(gallery(theme));
    const table = page.locator("#tracks").getByRole("table");
    for (const name of ["Who", "Grow in my role", "Change careers"]) {
      await expect(
        table.getByRole("columnheader", { name, exact: true }),
      ).toHaveCSS("font-weight", "600");
    }
    const rowHeaders = table.getByRole("rowheader");
    await expect(rowHeaders).toHaveCount(2);
    for (const cell of await rowHeaders.all())
      await expect(cell).toHaveCSS("font-weight", "600");
    await expect(table.getByRole("cell").first()).toHaveCSS(
      "font-weight",
      "400",
    );
    await expectAxeClean(page, "#tracks");
  });
}
