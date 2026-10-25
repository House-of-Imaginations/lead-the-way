import { E2E_DOMAIN, seedCareer } from "./demo";
import { expect, test } from "./fixtures";

// Review Focus 4: a career-only account never lands on /signed-out.
test("a career-only account is sent out of the team pages", async ({
  page,
}) => {
  const email = `e2e-career-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${E2E_DOMAIN}`;
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Kai Moreno", email, password: "a long enough password" },
    headers: { origin: "http://localhost:3000" },
  });
  expect(res.ok()).toBe(true);
  seedCareer(email);

  for (const path of [
    "/home",
    "/me",
    "/manager",
    "/workspace/settings",
    "/join/preview",
  ]) {
    await page.goto(path);
    await expect(page, path).toHaveURL("/careers/journey");
  }
  // D8: its settings are the career track's.
  await page.goto("/settings");
  await expect(page).toHaveURL("/careers/settings");
  // 11.4: it can still make a workspace.
  await page.goto("/setup/team");
  await expect(page).toHaveURL("/setup/start");
});
