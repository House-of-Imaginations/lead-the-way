import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { getShell, openOrHome } from "@/lib/account/queries";
import { WorkspaceSettings } from "./_components/WorkspaceSettings";

export const metadata: Metadata = {
  title: "Workspace settings · Lead the Way",
};

export default async function WorkspaceSettingsPage() {
  // The layout redirects everyone else; the page renders in parallel.
  const shell = await getShell();
  const tabs = shell?.workspaceSettings.tabs ?? [];
  if (tabs.length === 0) return null;
  // Each tab's read only for a seat that may open it (W-g).
  const settings = tabs.includes("general")
    ? await openOrHome(() => preloadAuthQuery(api.workspace.settings, {}))
    : null;
  return <WorkspaceSettings tabs={tabs} settings={settings} />;
}
