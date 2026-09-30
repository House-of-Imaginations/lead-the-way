// Pure invitation rules, shared by `launch`, `invites` and 07's form. No
// Convex imports, so the client can load this module without a function module.

/** At most this many addresses in one launch (Ruling 5). */
export const MAX_LAUNCH_INVITES = 50;

/** The longest message an invitation carries (Ruling 5). */
export const MAX_MESSAGE = 500;

/**
 * Deliberately loose: a real check is the email arriving. This only stops
 * typos like a missing @ or a pasted sentence, and the punctuation that turns
 * one address into several or into a display name (`"`, `<>`, `,`, `;`).
 */
export const EMAIL =
  /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

/**
 * An address as it is compared: trimmed, lowercased, and without the one
 * trailing dot a fully qualified domain may carry (it still delivers).
 */
export const normalEmail = (email: string) =>
  email.trim().toLowerCase().replace(/\.$/, "");
