import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, openOrHome } from "@/lib/account/queries";
import { Overview } from "./_components/Overview";

export const metadata: Metadata = { title: "Overview · From zero to hero" };

export default async function ManagerOverviewPage() {
  // The manager layout redirects everyone else; the page renders in parallel,
  // so it must not ask a manager-only query for them.
  const shell = await getShell();
  if (shell?.area !== "manager") return null;
  // openOrHome, not managerRead: any manager may read the overview (Ruling 6),
  // and managerRead's FORBIDDEN redirect would send /manager to itself.
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.manager.overview, { hour: currentHour() }),
  );
  return <Overview preloaded={preloaded} greeting={shell.greeting} />;
}
