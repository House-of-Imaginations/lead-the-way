import { defineConfig, devices } from "@playwright/test";

// The failure snapshot copies input values, the shared demo password included (P9 review B).
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

// e2e runs against `pnpm dev` and the Convex dev deployment in .env.local.
// Start `npx convex dev` yourself first; it is not a web server Playwright can own.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
