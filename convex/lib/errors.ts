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
  | "AVATAR_MISSING"
  | "AVATAR_TYPE"
  | "AVATAR_SIZE"
  | "RATE_LIMITED"
  // Organizations. `NOT_A_MEMBER` and `FORBIDDEN` are deliberately separate:
  // the client sends the first back to the workspace picker and explains the
  // second in place. `NOT_A_MEMBER` also covers "no such org", so probing an
  // id never distinguishes the two.
  | "NOT_A_MEMBER"
  | "FORBIDDEN"
  | "PERMISSION_ESCALATION"
  | "ORG_NAME_REQUIRED"
  | "SLUG_TAKEN"
  | "ROLE_IN_USE"
  | "ROLE_INVALID"
  | "LAST_OWNER"
  // Separate from the AVATAR_* codes even though the two share their limits:
  // the sentences differ ("a workspace picture", not "a picture"), and a client
  // branching on the code should not have to also know which screen it is on.
  | "ORG_IMAGE_MISSING"
  | "ORG_IMAGE_TYPE"
  | "ORG_IMAGE_SIZE"
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "EMAIL_UNVERIFIED"
  | "ALREADY_A_MEMBER";

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
