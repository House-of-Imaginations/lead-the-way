"use client";

import { useSyncExternalStore } from "react";
import { createAuthClient } from "better-auth/react";
import {
  lastLoginMethodClient,
  usernameClient,
} from "better-auth/client/plugins";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient(), usernameClient(), lastLoginMethodClient()],
});

const noSubscribe = () => () => {};

/**
 * The sign-in method used last on this browser ("email", "google", ...), or
 * null. Read from a cookie, so the server render always says null and the
 * client fills it in without a hydration mismatch.
 */
export function useLastLoginMethod(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => authClient.getLastUsedLoginMethod(),
    () => null,
  );
}
