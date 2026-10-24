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

/** Dan's public credential slug, read from the demo (it can gain a "-2" after seed:reset). */
export function demoBadgeSlug(): string {
  const slug = JSON.parse(
    convex(["run", "seed:badgeSlug", JSON.stringify({ email: PERSONA.dan })]),
  ) as string | null;
  if (!slug)
    throw new Error("Dan has no badge yet. Move the demo clock past week 1.");
  return slug;
}

/** A learner career profile for `email` (`seed:careerProfile`), until MS3 can start a track (P12a). */
export function seedCareer(email: string, isPrivate = true): void {
  convex([
    "run",
    "seed:careerProfile",
    JSON.stringify({ email, private: isPrivate }),
  ]);
}

/** `convex/seed.ts`'s `E2E_DOMAIN`: accounts on it go at `seed:reset` (Ruling 34). */
export const E2E_DOMAIN = "e2e.test";
export type DemoTarget =
  "setup" | "week1" | "week2" | "week3" | "week4" | "complete";

/** `pnpm exec convex <args>` against the dev deployment in `.env.local`; returns stdout. */
export function convex(args: string[]): string {
  return execFileSync("pnpm", ["exec", "convex", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function fromEnvLocal(key = "DEMO_PASSWORD"): string | undefined {
  try {
    const line = readFileSync(join(process.cwd(), ".env.local"), "utf8").match(
      new RegExp(`^${key}=(.*)$`, "m"),
    )?.[1];
    return line?.trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;
  } catch {
    return undefined;
  }
}

/** The dev deployment's URL, from the shell or `.env.local`. */
export function convexUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    fromEnvLocal("NEXT_PUBLIC_CONVEX_URL");
  if (!url)
    throw new Error("No NEXT_PUBLIC_CONVEX_URL in the shell or .env.local.");
  return url;
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
