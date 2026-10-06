"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { Tag } from "@/components/ui";
import { SettingsFrame } from "@/components/settings/SettingsFrame";
import { GeneralTab } from "./GeneralTab";

export type WorkspaceData = FunctionReturnType<typeof api.workspace.settings>;

/** 18 (P7b-2). Members and Roles are P7b-3's, so there is no Members tab yet. */
export function WorkspaceSettings({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.workspace.settings>;
}) {
  const data = usePreloadedQuery(preloaded);
  return (
    <SettingsFrame
      title="Workspace settings"
      lead={`${data.name}, ${data.teamName}. Changes apply to everyone in the workspace.`}
      aside={data.owner ? <Tag>{`Owner: ${data.owner}`}</Tag> : null}
      tabs={[
        {
          value: "general",
          label: "General",
          content: <GeneralTab data={data} />,
        },
      ]}
    />
  );
}
