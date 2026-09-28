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
