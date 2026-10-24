import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, managerRead } from "@/lib/account/queries";
import { Outcomes } from "./_components/Outcomes";

export const metadata: Metadata = { title: "Outcomes · From zero to hero" };

export default async function ManagerOutcomesPage() {
  // The manager layout redirects everyone else; don't ask for them.
  const shell = await getShell();
  if (shell?.area !== "manager") return null;
  // team:insights only (ROUTE_PERMISSION): a FORBIDDEN read goes to /manager.
  const preloaded = await managerRead(() =>
    preloadAuthQuery(api.manager.outcomes, { hour: currentHour() }),
  );
  return <Outcomes preloaded={preloaded} />;
}
