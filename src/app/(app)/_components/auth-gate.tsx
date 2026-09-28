"use client";

import type { ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { UnauthorizedScreen } from "@/components/UnauthorizedScreen";
import { useSignInHref } from "@/hooks/useSignInHref";

/**
 * The client-gate half of the 401 (see `(app)/layout.tsx`). The server gate
 * only catches a request that arrives already signed out; it cannot see
 * somebody signing out ON an `(app)` page, or the Back button restoring one
 * from the router cache without asking the server again. Both leave the
 * sidebar shell already mounted with Convex auth as the only thing that still
 * knows the session is gone, so this watches `useConvexAuth` and swaps just
 * the content area.
 *
 * `!isLoading` guards the flash a sign-in redirect would otherwise get for
 * one tick while the session settles -- children (the page's own pending
 * state) render through that instead.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const redirectTo = useSignInHref();

  if (!isLoading && !isAuthenticated) {
    return <UnauthorizedScreen redirectTo={redirectTo} />;
  }
  return <>{children}</>;
}
