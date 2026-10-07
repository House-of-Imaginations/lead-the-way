import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { currentHour, getShell, openOrHome } from "@/lib/account/queries";
import type { MembersData } from "./_components/MembersTab";
import { WorkspaceSettings } from "./_components/WorkspaceSettings";

export const metadata: Metadata = {
  title: "Workspace settings · Lead the Way",
};

/** Members' three reads, in parallel. `invites.list` is timed (Ruling 14). */
async function membersData(): Promise<MembersData> {
  const [people, invites, roles] = await Promise.all([
    fetchAuthQuery(api.members.list, {}),
    fetchAuthQuery(api.invites.list, { hour: currentHour() }),
    fetchAuthQuery(api.orgRoles.list, {}),
  ]);
  return { people, invites, roles };
}

export default async function WorkspaceSettingsPage() {
  // The layout redirects everyone else; the page renders in parallel.
  const shell = await getShell();
  const tabs = shell?.workspaceSettings.tabs ?? [];
  if (tabs.length === 0) return null;
  // Each tab's reads only for a seat that may open it (W-g).
  const [settings, members, roles] = await openOrHome(() =>
    Promise.all([
      tabs.includes("general")
        ? fetchAuthQuery(api.workspace.settings, {})
        : null,
      tabs.includes("members") ? membersData() : null,
      tabs.includes("roles") ? fetchAuthQuery(api.orgRoles.list, {}) : null,
    ]),
  );
  return (
    <WorkspaceSettings
      tabs={tabs}
      settings={settings}
      members={members}
      roles={roles}
    />
  );
}
