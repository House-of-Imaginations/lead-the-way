/// <reference types="vite/client" />
import { expect, test } from "vitest";

const sources = import.meta.glob(
  ["../../convex/**/*.ts", "!../../convex/_generated/**"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

/**
 * Every `Date.now()` in `convex/` that is real time on purpose. Anything that
 * stamps what somebody did in a workspace reads the workspace's clock instead
 * (`nowFor(org)`, or `ctx.viewer.now`), so the demo stamps demo time.
 */
const ALLOWED: {
  file: string;
  line: string;
  reason: string;
  uses?: number;
}[] = [
  { file: "lib/clock.ts", line: ": Date.now()", reason: "the clock itself" },
  {
    file: "invites.ts",
    line: "org ? nowFor(org) : Date.now()",
    reason: "a workspace that is gone has no demo clock",
  },
  {
    file: "invites.ts",
    line: "const expiresAt = Date.now() + INVITE_WINDOW_MS",
    reason: "a link lapses in real time, judged by the org's clock",
    uses: 2, // create and resend
  },
  {
    file: "lib/demo/script.ts",
    line: "expiresAt: Date.now() + INVITE_WINDOW_MS",
    reason: "the script's invitations lapse like any other link",
  },
  {
    file: "lib/demo/moveClock.ts",
    line: "appliedAt: Date.now()",
    reason: "when a step really ran, for debugging the script",
  },
  {
    file: "lib/orgs/create.ts",
    line: "const now = Date.now()",
    reason: "an org and its roles are created before any clock exists",
  },
  {
    file: "onboarding.ts",
    line: "termsAcceptedAt: Date.now()",
    reason: "the terms are accepted by an account, not in any workspace",
  },
  {
    file: "onboarding.ts",
    line: '.gt("expiresAt", Date.now())',
    reason: "a link lapses in real time, as `invites.create` sets it",
  },
  {
    file: "lib/demo/calderLane.ts",
    line: "const now = Date.now()",
    reason: "the demo org and its roles, as `createWorkspace` stamps them",
  },
  {
    file: "orgRoles.ts",
    line: "createdAt: Date.now()",
    reason: "a role's createdAt is shown nowhere, so real time will do",
  },
  {
    file: "lib/account/profile.ts",
    line: "createdAt: Date.now()",
    reason: "a profile belongs to an account, not to any workspace",
  },
];

test("Date.now() only where real time is meant", () => {
  const used = new Map<(typeof ALLOWED)[number], number>();
  const stray: string[] = [];
  for (const [path, source] of Object.entries(sources)) {
    const file = path.replace("../../convex/", "");
    source.split("\n").forEach((text, i) => {
      const code = text.trim();
      if (!code.includes("Date.now()")) return;
      if (code.startsWith("*") || code.startsWith("//")) return;
      const entry = ALLOWED.find(
        (a) => a.file === file && code.includes(a.line),
      );
      if (entry) used.set(entry, (used.get(entry) ?? 0) + 1);
      else stray.push(`${file}:${i + 1}: ${code}`);
    });
  }
  expect(stray).toEqual([]);
  // Each entry covers exactly its own uses: a stale entry, or a second line
  // that happens to match one, would let the next stray call in for free.
  expect(ALLOWED.filter((a) => (used.get(a) ?? 0) !== (a.uses ?? 1))).toEqual(
    [],
  );
});
