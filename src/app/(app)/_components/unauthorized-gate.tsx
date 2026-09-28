"use client";

import { UnauthorizedScreen } from "@/components/UnauthorizedScreen";
import { useSignInHref } from "@/hooks/useSignInHref";

/**
 * The server-gate half of the 401 (see `(app)/layout.tsx`): the layout already
 * knows, from the request's own cookies, that nobody is signed in, and reaches
 * for this only to learn the URL to send "Sign in" back to -- `usePathname`
 * and `useSearchParams` are client-only reads a layout cannot make itself.
 */
export function UnauthorizedGate() {
  return <UnauthorizedScreen redirectTo={useSignInHref()} />;
}
