/**
 * The rule of `initialsOf` in convex/lib/orgs/people.ts, which src can't
 * import (it reaches the auth component). Change both together.
 *
 * ponytail: a copy kept in step by hand (a parity test guards it). P9 moves
 * the rule into a pure convex/lib/initials.ts that src may import, allowlisted
 * in eslint.config.mjs, and deletes this file and its parity test.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0] ?? "";
  const last = words.length > 1 ? (words.at(-1) ?? "") : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
