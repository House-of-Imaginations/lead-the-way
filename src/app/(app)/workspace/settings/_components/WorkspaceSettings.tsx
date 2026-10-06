"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ComponentType } from "react";
import { api } from "@convex/_generated/api";
import type { WorkspaceTab } from "@convex/lib/shell";
import { useShell } from "@/components/app/AppShell";
import { Tag, type TabItem } from "@/components/ui";
import { SettingsFrame } from "@/components/settings/SettingsFrame";
import { GeneralTab } from "./GeneralTab";
import { PrivacyTab } from "./PrivacyTab";
import { SprintDefaultsTab } from "./SprintDefaultsTab";

export type WorkspaceData = FunctionReturnType<typeof api.workspace.settings>;

/** One `org:manage` tab, on the preloaded settings. */
function SettingsTab({
  preloaded,
  Tab,
}: {
  preloaded: Preloaded<typeof api.workspace.settings>;
  Tab: ComponentType<{ data: WorkspaceData }>;
}) {
  return <Tab data={usePreloadedQuery(preloaded)} />;
}

/**
 * 18. Each tab shows only for a seat holding its permission (W-g), and the
 * header comes from the shell, which every seat that opens 18 can read.
 */
export function WorkspaceSettings({
  tabs,
  settings,
}: {
  tabs: WorkspaceTab[];
  settings: Preloaded<typeof api.workspace.settings> | null;
}) {
  const { org, workspaceSettings } = useShell();
  const items: TabItem[] = [];
  if (tabs.includes("general") && settings) {
    items.push(
      {
        value: "general",
        label: "General",
        content: <SettingsTab preloaded={settings} Tab={GeneralTab} />,
      },
      {
        value: "sprint",
        label: "Sprint defaults",
        content: <SettingsTab preloaded={settings} Tab={SprintDefaultsTab} />,
      },
      {
        value: "privacy",
        label: "Data and privacy",
        content: <SettingsTab preloaded={settings} Tab={PrivacyTab} />,
      },
    );
  }
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
