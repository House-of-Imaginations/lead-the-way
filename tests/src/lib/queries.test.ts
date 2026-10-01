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

const { managerRead, openOrHome } =
  await import("../../../src/lib/account/queries");

test("managerRead sends FORBIDDEN to /manager and passes the rest on", async () => {
  const forbidden = new ConvexError({ code: "FORBIDDEN", message: "No." });
  await expect(
    managerRead(async () => {
      throw forbidden;
    }),
  ).rejects.toThrow("redirect /manager");
  const gone = new ConvexError({ code: "NOT_FOUND", message: "Gone." });
  await expect(
    managerRead(async () => {
      throw gone;
    }),
  ).rejects.toBe(gone);
  expect(await managerRead(async () => 7)).toBe(7);
  vi.stubEnv("APP_CLOSED", "on");
  await expect(
    managerRead(async () => assertFlag("closed", false)),
  ).rejects.toThrow("redirect /");
  vi.unstubAllEnvs();
});

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
