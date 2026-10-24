import { ConvexError } from "convex/values";

/**
 * Stable, machine-readable codes for every user-facing, user-actionable
 * failure in the backend.
 *
 * A plain `Error`'s message is redacted to "Server Error" on production
 * Convex deployments. `ConvexError`'s `.data` is delivered to the client
 * verbatim, so every throw the user can actually act on must go through
 * `throwUserError` below instead of `throw new Error(...)`.
 *
 * The client branches on `code`, which must never change once shipped.
 * `message` is the human-readable sentence already written at the call
 * site -- copy changes happen there, not here.
 */
export type ErrorCode =
  | "NOT_SIGNED_IN"
  | "FIELD_REQUIRED"
  | "NAME_REQUIRED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  // Organizations. `NOT_A_MEMBER` and `FORBIDDEN` are deliberately separate:
  // the client sends the first back to the workspace picker and explains the
  // second in place. `NOT_A_MEMBER` also covers "no such org", so probing an
  // id never distinguishes the two.
  | "NOT_A_MEMBER"
  // Signed in, but no workspace resolves: the client sends them to set one up.
  | "NO_WORKSPACE"
  // Signed in, but no career profile: the client sends them to start a track.
  | "NO_CAREER_TRACK"
  | "FORBIDDEN"
  | "PERMISSION_ESCALATION"
  | "ORG_NAME_REQUIRED"
  // Delete workspace: the typed name isn't the workspace's (R3).
  | "ORG_NAME_MISMATCH"
  | "SLUG_TAKEN"
  | "ROLE_IN_USE"
  | "ROLE_INVALID"
  | "LAST_OWNER"
  // A workspace picture's limits are the account avatar's (lib/account/avatar.ts).
  | "ORG_IMAGE_MISSING"
  | "ORG_IMAGE_TYPE"
  | "ORG_IMAGE_SIZE"
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "INVITE_REVOKED"
  | "INVITE_DECLINED"
  | "INVITE_USED"
  | "INVITE_WRONG_ACCOUNT"
  | "ALREADY_A_MEMBER"
  | "DEMO_NOT_SEEDED"
  // The demo workspace lacks a row the script needs: the fix is a reset.
  | "DEMO_BROKEN"
  | "DEMO_CLOCK_BACKWARDS"
  // A shared demo persona, while the demo is on, stays in the demo workspace.
  | "DEMO_ACCOUNT_CREATE"
  | "DEMO_ACCOUNT_JOIN"
  // The viewer's open workspace isn't the one the page was showing (R6).
  | "WORKSPACE_CHANGED"
  // Sign-up needs the terms box once (R8).
  | "TERMS_REQUIRED"
  // Setup edits after launch, and a launch before setup is done (P4).
  | "SPRINT_LAUNCHED"
  | "LAUNCH_NOT_READY"
  // Run another sprint (P7a).
  | "SPRINT_NOT_CLOSED"
  | "SPRINT_DRAFT_EXISTS"
  // The employee journey (P6).
  | "NO_SPRINT"
  | "CHECK_IN_CLOSED"
  | "CHECK_IN_DONE"
  | "AGREEMENT_CHANGED"
  | "AGREEMENT_NOT_SAVED"
  | "PROJECT_TITLE_REQUIRED"
  | "PROJECT_CHECKS_REQUIRED"
  | "PROJECT_TOO_LONG"
  | "PROJECT_NOT_SAVED"
  | "PROJECT_MISSING"
  | "SCREENSHOT_TYPE"
  | "SCREENSHOT_SIZE"
  | "SCREENSHOT_STALE"
  | "BADGE_MISSING";

export function isRateLimitedError(error: unknown): error is ConvexError<{
  code: "RATE_LIMITED";
  message: string;
  retryAfter: number;
}> {
  if (!(error instanceof ConvexError)) return false;
  const data: unknown = error.data;
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    record.code === "RATE_LIMITED" &&
    typeof record.message === "string" &&
    typeof record.retryAfter === "number"
  );
}

export function throwUserError(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

/** The `{code, message}` a backend function threw for a person, or null for an internal fault. */
export function userErrorOf(
  error: unknown,
): { code: string; message: string } | null {
  if (!(error instanceof ConvexError)) return null;
  const { code, message } = (error.data ?? {}) as {
    code?: unknown;
    message?: unknown;
  };
  return typeof code === "string" && typeof message === "string"
    ? { code, message }
    : null;
}
