"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import { api } from "@convex/_generated/api";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { SettingsFrame } from "@/components/settings/SettingsFrame";

/** 19: the employee's own settings. */
export function EmployeeSettings({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.settings.mine>;
}) {
  const mine = usePreloadedQuery(preloaded);
  return (
    <SettingsFrame
      lead={`Your account, reminders and what you share. Workspace settings are managed by ${mine.manager?.name ?? "your manager"}.`}
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
