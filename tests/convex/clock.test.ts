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
    reason: "a resent link lapses in real time, judged by the org's clock",
  },
  {
    file: "lib/orgs/invites.ts",
    line: "const expiresAt = Date.now() + INVITE_WINDOW_MS",
    reason: "every new link lapses in real time, the script's included",
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
  {
    file: "lib/viewer.ts",
    line: "return clock?.now ?? Date.now()",
    reason: "`Career.now`: real time outside the careers demo (spec 7)",
  },
  {
    file: "careers/drafts.ts",
    line: "const now = Date.now()",
    reason: "a Pivot Map draft has no account, so no careers clock (P9)",
  },
  {
    file: "careers/drafts.ts",
    line: "const cutoff = Date.now()",
    reason: "a draft expires 30 days after it was made, in real time (P9)",
  },
  {
    file: "careers/tracks.ts",
    line: 'name: "privateTrackStarted", at: Date.now()',
    reason: "the event is logged before the career profile has a clock",
  },
  {
    file: "onboarding.ts",
    line: "at: Date.now(),",
    reason: "a claimed draft's event, before the career profile has a clock",
  },
  {
    file: "lib/storage.ts",
    line: "Date.now() - uploaded._creationTime > FRESH_MS",
    reason: "`_storage` stamps an upload in real time (Ruling 24)",
  },
];

test("Date.now() only where real time is meant", () => {
  const used = new Map<(typeof ALLOWED)[number], number>();
  const stray: string[] = [];
  for (const [path, source] of Object.entries(sources)) {
    const file = path.replace("../../convex/", "");
    source.split("\n").forEach((text, i) => {
      const code = text.trim();
      // `new Date()` with no arguments is the same read of real time.
      if (!code.includes("Date.now()") && !code.includes("new Date()")) return;
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
