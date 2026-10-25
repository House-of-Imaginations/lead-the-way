import { cookies } from "next/headers";

/**
 * The Pivot Map draft's token (P9): the only key to an anonymous draft, so it
 * lives in an httpOnly cookie that `/careers/map` and sign-up read on the
 * server. 30 days, as long as the draft itself.
 */
export const DRAFT_COOKIE = "ltw-map-draft";
export const DRAFT_MAX_AGE = 30 * 24 * 60 * 60;

export async function draftToken(): Promise<string | undefined> {
  return (await cookies()).get(DRAFT_COOKIE)?.value || undefined;
}
