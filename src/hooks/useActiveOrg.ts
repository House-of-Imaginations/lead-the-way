import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import type { ActiveSeat } from "@/lib/workspace/types";

/**
 * Pure decision behind `useActiveOrg`, split out so the signed-out/pending
 * distinction (see the hook's own doc comment) can be unit tested without
 * mounting a Convex-authenticated React tree.
 */
export function resolveActiveSeat(
  isLoading: boolean,
  isAuthenticated: boolean,
  active: ActiveSeat | null | undefined,
): ActiveSeat | null | undefined {
  if (isLoading || (isAuthenticated && active === undefined)) return undefined;
  return isAuthenticated ? (active ?? null) : undefined;
}

/**
 * The seat every workspace screen reads: undefined while loading (including
 * signed out -- the `(app)` layout's auth gate handles that case, so a page
 * built around "undefined means pending" never needs to also mean "signed
 * out"), null once signed in with no workspace.
 */
export function useActiveOrg(): ActiveSeat | null | undefined {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const active = useQuery(api.orgs.active, isAuthenticated ? {} : "skip");
  return resolveActiveSeat(isLoading, isAuthenticated, active);
}
