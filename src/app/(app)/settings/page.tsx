import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { getShell, openOrHome } from "@/lib/account/queries";
import { ManagerSettings } from "./_components/ManagerSettings";

export const metadata: Metadata = { title: "Settings · From Zero to Hero" };

/** 17 is the manager area's settings; everyone else has theirs at 19 (Ruling 12). */
export default async function SettingsPage() {
  const shell = await getShell();
  // Null is the (app) layout's to handle; it renders in parallel with this page.
  if (!shell) return null;
  if (shell.area !== "manager") redirect("/me/settings");
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.settings.mine, {}),
  );
  return <ManagerSettings preloaded={preloaded} />;
}
