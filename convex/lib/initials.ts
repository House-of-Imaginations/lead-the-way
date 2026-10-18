/**
 * Two letters for an avatar: the first and last word of a name, "?" for none.
 * Pure, so `src` imports it too (the landing header and the join page).
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0] ?? "";
  const last = words.length > 1 ? (words.at(-1) ?? "") : "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}
