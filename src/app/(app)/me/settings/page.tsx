import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { getShell, openOrHome } from "@/lib/account/queries";
import { EmployeeSettings } from "./_components/EmployeeSettings";

export const metadata: Metadata = { title: "Settings · From zero to hero" };

export default async function SettingsPage() {
  // The layout redirects everyone else; the page renders in parallel.
  const shell = await getShell();
  if (shell?.area !== "employee") return null;
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.settings.mine, {}),
  );
  return <EmployeeSettings preloaded={preloaded} />;
}
