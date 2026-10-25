"use server";

import { cookies } from "next/headers";
import { api } from "@convex/_generated/api";
import {
  DRAFT_COOKIE,
  draftToken as readDraft,
} from "@/lib/careers/draftCookie";
import { userMessage } from "@/lib/errors";
import { fetchAuthMutation } from "./auth-server";

/**
 * Finish sign-up (R8): record the terms, then make a workspace or find the
 * invitation. A sign-up from a join link passes its token, and goes back to
 * the link (Ruling 19). Convex checks the session; this only carries the
 * cookie across.
 */
export async function startAccount(
  acceptTerms: boolean,
  token?: string,
  track?: "team" | "career",
): Promise<{ next: string } | { error: string }> {
  try {
    // Spec 5.3: a career sign-up claims the Pivot Map draft in the cookie.
    // An invitation joins a team instead, so its draft stays for later.
    const draftToken =
      track === "career" && !token ? await readDraft() : undefined;
    const next = await fetchAuthMutation(api.onboarding.start, {
      acceptTerms,
      token,
      track,
      draftToken,
    });
    if (draftToken) (await cookies()).delete(DRAFT_COOKIE);
    return { next };
  } catch (error) {
    return {
      error: userMessage(error, "We couldn't set up your account. Try again."),
    };
  }
}
