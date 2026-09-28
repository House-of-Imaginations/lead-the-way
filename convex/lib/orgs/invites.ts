/**
 * The credential on an invitation link, and how long it is good for.
 *
 * Pure and separate from the mutations, like `lib/account/window.ts`: this is
 * the half where being quietly wrong costs something, so it is testable without
 * a database.
 */

/**
 * A week. Capped HERE and never taken from the caller.
 *
 * An expiry a client chooses is not an expiry. The window is also what bounds
 * every other risk on this row: a role widened after the link was minted, a
 * link forwarded to somebody it was not meant for, a mailbox later
 * compromised. Seven days is short enough to bound those and long enough that
 * somebody who was on holiday can still use it.
 */
export const INVITE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 256 bits from the platform CSPRNG, base64url so it survives a URL intact.
 *
 * `crypto.randomUUID()` would be 122 bits, which is fine in practice, but this
 * is a bearer credential -- whoever holds it joins the workspace -- and the
 * extra entropy costs nothing. `Math.random()` would be a defect: it is seeded
 * per execution and is not a CSPRNG.
 */
export function mintToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
