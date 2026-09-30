"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Id } from "@convex/_generated/dataModel";

const ExpectOrgId = createContext<Id<"orgs"> | null>(null);

/**
 * The workspace this page was rendered for (R6), from `shell.expectOrgId` on
 * the server. `AppShell` and the setup guard both provide it.
 */
export function ExpectOrgIdProvider({
  value,
  children,
}: {
  value: Id<"orgs">;
  children: ReactNode;
}) {
  return <ExpectOrgId value={value}>{children}</ExpectOrgId>;
}

/**
 * Product forms echo it on every mutation. It never follows the live shell:
 * a switch in another tab must make a stale form fail, not quietly aim it at
 * the other workspace.
 */
export function useExpectOrgId(): Id<"orgs"> {
  const id = useContext(ExpectOrgId);
  if (!id) throw new Error("useExpectOrgId needs a workspace page above it.");
  return id;
}
