/** The token in a `next` of `/join/<token>`, with an optional slash, query or hash. */
export function joinTokenOf(next: unknown): string | undefined {
  return typeof next === "string"
    ? /^\/join\/([^/?#]+)\/?(?:[?#].*)?$/.exec(next)?.[1]
    : undefined;
}
