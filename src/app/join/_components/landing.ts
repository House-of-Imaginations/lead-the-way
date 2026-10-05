/**
 * Where a join goes when there is no before check-in to answer (RR2, GC-M8):
 * the person's own home, which `/home` resolves for either area. Null means
 * show the check-in.
 */
export const landingAfterJoin = (
  join: { askBefore: boolean } | null,
): string | null => (join?.askBefore === false ? "/home" : null);
