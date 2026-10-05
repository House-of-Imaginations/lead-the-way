"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import { api } from "@convex/_generated/api";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { SettingsFrame } from "@/components/settings/SettingsFrame";

/** 17: Priya's own settings. Team and sprint settings are Workspace settings (P7b-2). */
export function ManagerSettings({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.settings.mine>;
}) {
  const mine = usePreloadedQuery(preloaded);
  return (
    <SettingsFrame
      lead="Your personal account settings. Team and sprint settings live in Workspace settings."
      tabs={[
        {
          value: "profile",
          label: "Profile",
          content: <ProfileTab mine={mine} />,
        },
      ]}
    />
  );
}
