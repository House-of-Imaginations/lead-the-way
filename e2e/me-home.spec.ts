import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { resetDemo, signInAs } from "./demo";

const SIMULATED = "Simulated in this prototype.";
const IDEA_LABELS = [
  "Improve a client report",
  "Create a reusable prompt template",
  "Improve a repetitive email workflow",
  "Analyse recurring information",
  "Structure meeting notes",
  "Draft for human review",
];
const CHECK_IN = "How did the sprint go?";

const main = (page: Page) => page.getByRole("main");
const card = (page: Page, name: string) =>
  main(page).getByRole("region", { name, exact: true });
const strip = (page: Page) =>
  main(page).getByRole("list", { name: "Your sprint", exact: true });
const weeks = (page: Page) =>
  main(page)
    .getByRole("list", { name: "Weeks", exact: true })
    .locator(":scope > li");
const sprintBar = (page: Page) =>
  main(page).getByRole("progressbar", { name: "Sprint progress" });

async function open(page: Page, path = "/me") {
  await signInAs(page, "dan");
  await page.goto(path);
}

// Uncaught errors, which would raise the Next dev overlay.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test.describe.serial("week 2 as Dan", () => {
  test.beforeAll(() => resetDemo("week2"));

  test("11 reads as the wireframe", async ({ page }) => {
    await open(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Good afternoon, Dan" }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        "Week 2 of 4. Your protected hour starts today at 2:00 PM.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      main(page).getByText("Protected time, Wed 2:00 to 3:00 PM", {
        exact: true,
      }),
    ).toBeVisible();

    const learn = card(page, "Learn");
    await expect(learn).toContainText("15 min session");
    await expect(learn).toContainText("AI Productivity Fundamentals");
    await expect(learn).toContainText(
      "Session 2: writing reusable prompts for recurring work.",
    );
    await expect(
      learn.getByRole("progressbar", { name: "Course progress" }),
    ).toHaveAttribute("aria-valuenow", "60");
    await expect(
      learn.getByRole("button", { name: "Continue learning" }),
    ).toBeVisible();

    const apply = card(page, "Apply");
    await expect(apply).toContainText("Use one idea in a real work task");
    await expect(apply.getByRole("listitem")).toHaveText(IDEA_LABELS, {
      useInnerText: true,
    });
    for (const link of await apply.getByRole("link").all()) {
      await expect(link).toHaveAttribute("href", "/me/project");
    }
    await expect(
      apply.getByRole("link", { name: "Start work project" }),
    ).toBeVisible();

    const reflect = card(page, "Reflect");
    await expect(reflect).toContainText("Not started");
    await expect(reflect).toContainText("What changed, and how you checked it");
    await expect(
      reflect.getByRole("link", { name: "Add reflection" }),
    ).toHaveAttribute("href", "/me/project#reflect");

    await expect(strip(page).getByRole("listitem")).toHaveText(
      ["Week 1 Done", "Week 2 In progress", "Week 3 23 Sep", "Week 4 Show and tell"],
      { useInnerText: true },
    );
    await expect(strip(page).locator('li[aria-current="step"]')).toContainText(
      "Week 2",
    );
    await expect(
      main(page).getByRole("link", { name: "View sprint" }),
    ).toHaveAttribute("href", "/me/sprint");
    await expect(
      main(page).getByText(
        "You are not expected to learn after hours. This session is part of your working week.",
        { exact: true },
      ),
    ).toBeVisible();

    const agreement = card(page, "Team AI Agreement");
    await expect(agreement.getByRole("term")).toHaveText([
      "Tools we use",
      "Never goes in",
      "Unsure?",
    ]);
    await expect(agreement.getByRole("definition")).toHaveText([
      "Microsoft Copilot, ChatGPT Enterprise",
      "Client names, Personal information, Passwords, and 2 more",
      "Ask Priya Raman",
    ]);
    await expect(
      agreement.getByRole("link", { name: "Read in full" }),
    ).toHaveAttribute("href", "/me/agreement");

    // Signed on the 9th, unchanged since; the after check-in waits for week 4.
    await expect(main(page).getByText("Please review and sign.")).toHaveCount(0);
    await expect(main(page).getByText(CHECK_IN, { exact: true })).toHaveCount(0);
  });

  test("13 counts two of eight and names the next session", async ({
    page,
  }) => {
    await open(page, "/me/sprint");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your AI sprint" }),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        "9 to 30 September 2026. Two of eight activities done.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(sprintBar(page)).toHaveAttribute("aria-valuetext", "2 of 8");

    await expect(weeks(page)).toHaveCount(4);
    await expect(weeks(page).getByRole("heading", { level: 2 })).toHaveText([
      "Week 1",
      "Week 2",
      "Week 3",
      "Week 4",
    ]);
    await expect(weeks(page).nth(0)).toContainText("Done");
    const now = weeks(page).nth(1);
    await expect(now).toHaveAttribute("aria-current", "step");
    await expect(now).toContainText("Now");
    await expect(now).toContainText("16 September");
    await expect(
      now.getByRole("link", { name: "Apply, in progress" }),
    ).toHaveAttribute("href", "/me/project");
    await expect(
      weeks(page).nth(3).getByRole("link", { name: "Show and tell" }),
    ).toHaveAttribute("href", "/me/show-and-tell");

    const next = card(page, "Next protected learning session");
    await expect(next).toContainText("Wednesday, 2:00 PM");
    await expect(next).toContainText(
      "16 September, 1 hour, protected from meetings",
    );
    await next.getByRole("button", { name: "Add to calendar" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Download .ics" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Open in Google Calendar" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      main(page).getByText("This is work time.", { exact: true }),
    ).toBeVisible();
  });

  test("Continue learning marks session 2 done, and 13 counts three", async ({
    page,
  }) => {
    await open(page);
    const learn = card(page, "Learn");
    await learn.getByRole("button", { name: "Continue learning" }).click();
    await expect(page.getByText(SIMULATED, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Session 2 marked done.", { exact: true }),
    ).toBeVisible();
    // Never lower: two sessions is 50%, so the script's 60% stays.
    await expect(
      learn.getByRole("progressbar", { name: "Course progress" }),
    ).toHaveAttribute("aria-valuenow", "60");

    await page.goto("/me/sprint");
    await expect(
      main(page).getByText(
        "9 to 30 September 2026. Three of eight activities done.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(sprintBar(page)).toHaveAttribute("aria-valuetext", "3 of 8");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`11 and 13 are axe clean, ${scheme}`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await expect(card(page, "Learn")).toBeVisible();
      await expectAxeClean(page);
      await page.goto("/me/sprint");
      await expect(weeks(page)).toHaveCount(4);
      await expectAxeClean(page);
    });

    test(`M2: the cards stack at 390px, ${scheme} @mobile`, async ({
      page,
      expectAxeClean,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      const boxes = [];
      for (const name of ["Learn", "Apply", "Reflect"]) {
        boxes.push((await card(page, name).boundingBox())!);
      }
      const [learn, apply, reflect] = boxes as [
        (typeof boxes)[number],
        (typeof boxes)[number],
        (typeof boxes)[number],
      ];
      expect(apply.x).toBe(learn.x);
      expect(reflect.x).toBe(learn.x);
      expect(apply.y).toBeGreaterThanOrEqual(learn.y + learn.height);
      expect(reflect.y).toBeGreaterThanOrEqual(apply.y + apply.height);
      for (const target of [
        card(page, "Learn").getByRole("button", { name: "Continue learning" }),
        card(page, "Apply").getByRole("link", { name: "Start work project" }),
        card(page, "Reflect").getByRole("link", { name: "Add reflection" }),
        main(page).getByRole("link", { name: "View", exact: true }),
      ]) {
        expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      }
      await expect(card(page, "Learn").getByText("15 min session")).toBeHidden();
      await expect(
        card(page, "Learn").getByText("15 min", { exact: true }),
      ).toBeVisible();
      await expect(strip(page).getByRole("listitem")).toHaveText(
        ["Wk 1 Done", "Wk 2 Now", "Wk 3 23 Sep", "Wk 4 30 Sep"],
        { useInnerText: true },
      );
      await expect(
        main(page).getByRole("link", { name: "View", exact: true }),
      ).toHaveAttribute("href", "/me/sprint");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
      await expectAxeClean(page);
    });
  }
});

test.describe.serial("week 4 as Dan", () => {
  test.beforeAll(() => resetDemo("week4"));

  test("the after check-in waits on /me until it is answered", async ({
    page,
  }) => {
    await open(page);
    await expect(
      main(page).getByText(
        "Week 4 of 4. Your protected hour starts today at 2:00 PM.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(main(page).getByText(CHECK_IN, { exact: true })).toBeVisible();
    // After: no skip (Ruling 7).
    await expect(
      main(page).getByRole("button", { name: "Skip for now" }),
    ).toHaveCount(0);
    for (const legend of [
      "How confident do you feel using AI at work?",
      "I feel comfortable telling my manager how I use AI at work.",
    ]) {
      await main(page)
        .getByRole("group", { name: legend })
        .getByRole("radio", { name: "4", exact: true })
        .check();
    }
    await main(page).getByRole("button", { name: "Save answers" }).click();
    await expect(main(page).getByText(CHECK_IN, { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Good afternoon, Dan" }),
    ).toBeVisible();
    await expect(main(page).getByText(CHECK_IN, { exact: true })).toHaveCount(0);
  });
});
