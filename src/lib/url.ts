/** `pathname?query` with `patch` applied; null or "" removes the key. */
export function withParams(
  pathname: string,
  current: string,
  patch: Record<string, string | null>,
) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * `next` from a query string, if it stays on this site; else null. Only a
 * path: one leading "/", not "//" or "/\" (browsers read both as another
 * host), and no control characters (browsers drop a tab or newline, which
 * turns "/\t/evil.example" into "//evil.example").
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !/^\/(?![/\\])/.test(next)) return null;
  return /[\u0000-\u001f\u007f]/.test(next) ? null : next;
}
