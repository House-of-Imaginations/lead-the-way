import { expect, test } from "./fixtures";
import { E2E_DOMAIN, convex, resetDemo } from "./demo";

test.describe("A seat that goes while a page is open", () => {
  test.beforeAll(() => resetDemo("week2"));
  test.afterAll(() => resetDemo());

  test("a page whose seat goes lands on /home's answer, not an error (R8)", async ({
    page,
  }) => {
    // A real account on e2e.test (Ruling 34), joined to Calder Lane as in leave.spec.ts.
    const email = `e2e-lost-seat-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
    const res = await page.request.post("/api/auth/sign-up/email", {
      data: { name: "Kai Moreno", email, password: "a long enough password" },
      headers: { origin: "http://localhost:3000" },
    });
    expect(res.ok()).toBe(true);
    const token = JSON.parse(
      convex(["run", "seed:invite", JSON.stringify({ email })]),
    ) as string;
    await page.goto(`/join/${token}`);
    await page.getByRole("button", { name: "Join team sprint" }).click();
    // The before check-in is still open at week 2.
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL("/me");

    // A second tab in the same session.
    const other = await page.context().newPage();
    await other.goto("/me/sprint");
    await expect(other.getByRole("heading", { level: 1 })).toBeVisible();

    convex(["run", "seed:unseat", JSON.stringify({ email })]);

    for (const p of [page, other]) {
      await expect(p).toHaveURL("/start", { timeout: 10_000 });
      await expect(p.getByText("Something went wrong")).toHaveCount(0);
    }
  });
});
