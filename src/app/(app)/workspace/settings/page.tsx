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
  if (!shell?.workspaceSettings.open) return null;
  const preloaded = await openOrHome(() =>
    preloadAuthQuery(api.workspace.settings, {}),
  );
  return <WorkspaceSettings preloaded={preloaded} />;
}
