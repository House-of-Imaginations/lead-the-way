import { cookies } from "next/headers";

/**
 * The Pivot Map draft's token (P9): the only key to an anonymous draft, so it
 * lives in an httpOnly cookie that `/careers/map` and sign-up read on the
 * server. A session cookie: partner pages run on shared library computers, so
 * the map goes when the browser closes (the Convex draft keeps its 30 days).
 */
export const DRAFT_COOKIE = "ltw-map-draft";

export async function draftToken(): Promise<string | undefined> {
  return (await cookies()).get(DRAFT_COOKIE)?.value || undefined;
}
