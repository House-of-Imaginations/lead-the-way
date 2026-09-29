import { afterEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { harness } from "./workspace/helpers";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Exactly these env vars set, every other provider half blank. */
function only(pairs: Record<string, string>) {
  for (const name of ["GOOGLE", "GITHUB", "DISCORD"]) {
    vi.stubEnv(`${name}_CLIENT_ID`, "");
    vi.stubEnv(`${name}_CLIENT_SECRET`, "");
  }
  for (const [key, value] of Object.entries(pairs)) vi.stubEnv(key, value);
}

test("a provider is on only when both halves of its pair are set", async () => {
  const t = harness();
  only({});
  expect(await t.query(api.authMethods.enabled, {})).toEqual([]);

  only({ GITHUB_CLIENT_ID: "id" });
  expect(await t.query(api.authMethods.enabled, {})).toEqual([]);

  only({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" });
  expect(await t.query(api.authMethods.enabled, {})).toEqual(["github"]);

  only({
    DISCORD_CLIENT_ID: "d",
    DISCORD_CLIENT_SECRET: "d",
    GITHUB_CLIENT_ID: "h",
    GITHUB_CLIENT_SECRET: "h",
    GOOGLE_CLIENT_ID: "g",
    GOOGLE_CLIENT_SECRET: "g",
  });
  // A fixed order, so the buttons never shuffle.
  expect(await t.query(api.authMethods.enabled, {})).toEqual([
    "google",
    "github",
    "discord",
  ]);
});
