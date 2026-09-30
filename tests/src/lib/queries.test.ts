import { ConvexError } from "convex/values";
import { expect, test, vi } from "vitest";
import { assertFlag } from "../../../convex/app";

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("../../../src/lib/account/auth-server", () => ({
  fetchAuthQuery: vi.fn(),
}));

const { openOrHome } = await import("../../../src/lib/account/queries");

test("openOrHome sends a closed app home, and only a closed app", async () => {
  vi.stubEnv("APP_CLOSED", "on");
  await expect(
    openOrHome(async () => assertFlag("closed", false)),
  ).rejects.toThrow("redirect /");
  vi.unstubAllEnvs();

  // FEATURE_UNAVAILABLE for another flag (the demo off) is not a closed app.
  const demoOff = new ConvexError({
    code: "FEATURE_UNAVAILABLE",
    flag: "demo",
    message: "This isn't available right now.",
  });
  await expect(
    openOrHome(async () => {
      throw demoOff;
    }),
  ).rejects.toBe(demoOff);
});
