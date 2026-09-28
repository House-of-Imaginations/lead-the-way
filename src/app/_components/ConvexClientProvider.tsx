"use client";

import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { authClient } from "@/lib/account/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      // Upstream typing defect, not a version mismatch: the `AuthClient` type
      // exported by @convex-dev/better-auth collapses `useSession().data` to
      // `never`, so the real client's `{ user, session } | null` cannot satisfy
      // it and tsc reports TS2322. Runtime is unaffected -- the value IS the
      // client the provider wants. All three packages sit inside their declared
      // peer ranges (better-auth 1.6.30, @convex-dev/better-auth 0.12.5,
      // convex 1.45.0; checked 2026-09-07, 0.12.5 is the latest published), so
      // there is no upgrade to take. Delete this assertion the moment upstream
      // fixes the type -- `npx tsc --noEmit` will stay clean if it is no longer
      // needed, and this is deliberately the only call site it covers.
      authClient={authClient as unknown as AuthClient}
      initialToken={initialToken}
    >
      {/*
       * Keeps a query's subscription alive for a short while after the last
       * component reading it unmounts, so going back to a screen re-renders
       * from what is already held instead of flashing a skeleton and asking
       * again. Inside the auth provider, not outside: a cached result is
       * per-identity, and signing out has to take the cache with it.
       *
       * Paired with `useQuery` imported from `convex-helpers/react/cache`
       * rather than `convex/react` -- the provider alone changes nothing, the
       * hook is what reads it. `useMutation` and `useAction` are unaffected
       * and still come from `convex/react`.
       */}
      <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>
    </ConvexBetterAuthProvider>
  );
}
