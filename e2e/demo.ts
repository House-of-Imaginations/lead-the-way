import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/**
 * The demo cast for e2e. The password is never written to a tracked file: it
 * comes from DEMO_PASSWORD in the shell, then `.env.local` (git-ignored), then
 * the Convex dev deployment's env.
 */
export const PERSONA = {
  priya: "priya.raman@calderlane.com.au",
  dan: "dan.okafor@calderlane.com.au",
} as const;
export type Persona = keyof typeof PERSONA;
export type DemoTarget =
  "setup" | "week1" | "week2" | "week3" | "week4" | "complete";

/** `pnpm exec convex <args>` against the dev deployment in `.env.local`; returns stdout. */
export function convex(args: string[]): string {
  return execFileSync("pnpm", ["exec", "convex", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function fromEnvLocal(): string | undefined {
  try {
    const line = readFileSync(join(process.cwd(), ".env.local"), "utf8").match(
      /^DEMO_PASSWORD=(.*)$/m,
    )?.[1];
    return line?.trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;
  } catch {
    return undefined;
  }
}

let password: string | undefined;
export function demoPassword(): string {
  password ??=
    process.env.DEMO_PASSWORD ||
    fromEnvLocal() ||
    convex(["env", "get", "DEMO_PASSWORD"]).trim();
  if (!password)
    throw new Error(
      "No DEMO_PASSWORD: set it in the shell, in .env.local, or on the Convex deployment.",
    );
  return password;
}

/** Reseed Calder Lane (setup, 1 September), then move its clock to `target`. */
export function resetDemo(target: DemoTarget = "setup") {
  convex(["run", "seed:reset"]);
  if (target !== "setup")
    convex(["run", "seed:clock", JSON.stringify({ target })]);
}

/** Sign in through the real endpoint; the page's context keeps the cookie. */
export async function signInAs(page: Page, who: Persona) {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: PERSONA[who], password: demoPassword() },
    headers: { origin: "http://localhost:3000" },
  });
  if (!res.ok())
    throw new Error(`Signing in as ${who} failed: ${res.status()}`);
}
