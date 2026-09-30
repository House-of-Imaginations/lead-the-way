"use server";

import { api } from "@convex/_generated/api";
import { userMessage } from "@/lib/errors";
import { fetchAuthMutation } from "./auth-server";

/**
 * Finish sign-up (R8): record the terms, then make a workspace or find the
 * invitation. Convex checks the session; this only carries the cookie across.
 */
export async function startAccount(
  acceptTerms: boolean,
): Promise<{ next: string } | { error: string }> {
  try {
    return {
      next: await fetchAuthMutation(api.onboarding.start, { acceptTerms }),
    };
  } catch (error) {
    return {
      error: userMessage(error, "We couldn't set up your account. Try again."),
    };
  }
}
