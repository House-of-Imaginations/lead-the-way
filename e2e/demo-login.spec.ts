import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { PERSONA, demoPassword, resetDemo } from "./demo";

// Task 9: log in as a demo person from /login. The password stays on the server.

const picker = (page: Page) =>
  page.getByRole("combobox", { name: "Demo account" });

async function pick(page: Page, name: string) {
  await picker(page).click();
  await page.getByRole("option", { name }).click();
  await expect(picker(page)).toHaveText(name);
}

/** Whether the page's HTML, or any of its form values, holds the password. */
const holdsPassword = (page: Page) =>
  page.evaluate(
    (secret) =>
      document.documentElement.outerHTML.includes(secret) ||
      [...document.querySelectorAll("input")].some((i) =>
        i.value.includes(secret),
      ),
    demoPassword(),
  );

test.beforeAll(() => resetDemo("week1"));

for (const width of [1440, 390]) {
  test(`the picker lists the cast and passes axe at ${width} @mobile`, async ({
    page,
    expectAxeClean,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(picker(page)).toHaveAccessibleDescription(
      "Concept prototype. Pick a demo person to look around.",
    );
    await expectAxeClean(page);
    await picker(page).click();
    const dan = page.getByRole("option", { name: "Dan Okafor" });
    await expect(dan).toContainText(`${PERSONA.dan} · Employee`);
    await expect(
      page.getByRole("option", { name: "Priya Raman" }),
    ).toContainText(`${PERSONA.priya} · Manager`);
    await expect(page.getByRole("option")).toHaveCount(8);
    const menu = (await page.getByRole("listbox").boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
    // Open, Radix hides the rest of the page from assistive tech: check the list.
    await expectAxeClean(page, "[role=listbox]");
    // One blue primary in the view: the single Log in.
    await page.keyboard.press("Escape");
    await expect(page.locator(".ltw-btn-primary")).toHaveCount(1);
  });
}

test("pick Dan, log in, land on his home, and never see the password", async ({
  page,
}) => {
  await page.goto("/login");
  await pick(page, "Dan Okafor");
  const reply = page.waitForResponse("**/api/demo/login");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  expect((await reply).status()).toBe(204);
  await expect(page).toHaveURL("/me");
  await expect(
    page.getByRole("heading", { level: 1, name: /, Dan$/ }),
  ).toBeVisible();
  expect(await holdsPassword(page)).toBe(false);
});

test("pick Priya, land on the manager dashboard @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  expect(await holdsPassword(page)).toBe(false);
  await pick(page, "Priya Raman");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/manager");
  expect(await holdsPassword(page)).toBe(false);
});

test("typing an email clears the demo choice", async ({ page }) => {
  await page.goto("/login");
  await pick(page, "Dan Okafor");
  await page.getByLabel("Work email").fill("someone@example.com");
  await expect(picker(page)).toHaveText("Choose a person");
});

test("the endpoint answers with a cookie only, and refuses anyone outside the cast", async ({
  page,
}) => {
  const post = (email: string) =>
    page.request.post("/api/demo/login", {
      data: { email },
      headers: { origin: "http://localhost:3000" },
    });
  const omar = await post("omar.haddad@calderlane.com.au");
  expect(omar.status()).toBe(401);
  expect(await omar.text()).toBe("");
  const dan = await post(PERSONA.dan);
  expect(dan.status()).toBe(204);
  expect(await dan.text()).toBe("");
  expect(dan.headers()["set-cookie"]).toBeTruthy();
});
