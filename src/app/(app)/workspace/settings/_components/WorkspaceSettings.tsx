"use client";

import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";
import type { ComponentType } from "react";
import { api } from "@convex/_generated/api";
import type { WorkspaceTab } from "@convex/lib/shell";
import { useShell, useWorkspaceSwitched } from "@/components/app/AppShell";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import { Tag, type TabItem } from "@/components/ui";
import { SettingsFrame } from "@/components/settings/SettingsFrame";
import { GeneralTab } from "./GeneralTab";
import { MembersTab, type MembersData, type Role } from "./MembersTab";
import { PrivacyTab } from "./PrivacyTab";
import { RolesTab } from "./RolesTab";
import { SprintDefaultsTab } from "./SprintDefaultsTab";

export type WorkspaceData = FunctionReturnType<typeof api.workspace.settings>;

/**
 * One `org:manage` tab, guarded as Members is (R-g, C2). No live read once the
 * shell drops the tab or another browser tab switched workspace, and never
 * another workspace's settings, read by the server render or live. Then the
 * tab is empty under AppShell's reload notice.
 */
function SettingsTab({
  initial,
  Tab,
}: {
  initial: WorkspaceData;
  Tab: ComponentType<{ data: WorkspaceData }>;
}) {
  const switched = useWorkspaceSwitched();
  const expectOrgId = useExpectOrgId();
  const allowed =
    useShell().workspaceSettings.tabs.includes("general") && !switched;
  const own = (data: WorkspaceData | undefined) =>
    data?.orgId === expectOrgId ? data : undefined;
  const data =
    own(useQuery(api.workspace.settings, allowed ? {} : "skip")) ??
    own(initial);
  return data ? <Tab data={data} /> : null;
}

/**
 * 18. Each tab shows only for a seat holding its permission (W-g), and the
 * header comes from the shell, which every seat that opens 18 can read.
 */
export function WorkspaceSettings({
  tabs,
  settings,
  members,
  roles,
}: {
  tabs: WorkspaceTab[];
  settings: WorkspaceData | null;
  members: MembersData | null;
  roles: Role[] | null;
}) {
  const { org, workspaceSettings } = useShell();
  // Both the page's tabs and the live shell's: a seat that loses a permission
  // mid-session loses the tab at once, before the server's next render.
  const open = (tab: WorkspaceTab) =>
    tabs.includes(tab) && workspaceSettings.tabs.includes(tab);
  const general = open("general") ? settings : null;
  const items: TabItem[] = [
    ...(general
      ? [
          {
            value: "general",
            label: "General",
            content: <SettingsTab initial={general} Tab={GeneralTab} />,
          },
        ]
      : []),
    ...(open("members") && members
      ? [
          {
            value: "members",
            label: "Members",
            content: <MembersTab initial={members} />,
          },
        ]
      : []),
    ...(general
      ? [
          {
            value: "sprint",
            label: "Sprint defaults",
            content: <SettingsTab initial={general} Tab={SprintDefaultsTab} />,
          },
          {
            value: "privacy",
            label: "Data and privacy",
            content: <SettingsTab initial={general} Tab={PrivacyTab} />,
          },
        ]
      : []),
    ...(open("roles") && roles
      ? [
          {
            value: "roles",
            label: "Roles",
            content: <RolesTab initial={roles} />,
          },
        ]
      : []),
  ];
  return (
    <SettingsFrame
      title="Workspace settings"
      lead={`${[org.name, org.team].filter(Boolean).join(", ")}. Changes apply to everyone in the workspace.`}
      aside={
        workspaceSettings.owner ? (
          <Tag>{`Owner: ${workspaceSettings.owner}`}</Tag>
        ) : null
      }
      tabs={items}
    />
  );
}
