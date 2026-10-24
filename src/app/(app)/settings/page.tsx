import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { getShell, openOrHome } from "@/lib/account/queries";
import { ManagerSettings } from "./_components/ManagerSettings";

export const metadata: Metadata = { title: "Settings · From hero to zero" };

export default async function SettingsPage() {
  // The layout redirects everyone else; the page renders in parallel.
  const shell = await getShell();
  if (shell?.area !== "manager") return null;
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.settings.mine, {}),
  );
  return <ManagerSettings preloaded={preloaded} />;
}
