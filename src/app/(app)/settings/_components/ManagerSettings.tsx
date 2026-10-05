"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import { api } from "@convex/_generated/api";
import { InlineNotification } from "@/components/ui";
import { NeverSees } from "@/components/settings/NeverSees";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { REMINDER_ROWS, ToggleList } from "@/components/settings/ToggleList";
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
        {
          value: "notifications",
          label: "Notifications",
          content: <ToggleList rows={REMINDER_ROWS} values={mine.settings} />,
        },
        {
          value: "privacy",
          label: "Privacy",
          // Managers are never counted (R-f): nothing here to switch.
          content: (
            <div className="flex max-w-[640px] flex-col gap-06 pt-07">
              <InlineNotification title="Private to you.">
                Your own pathway progress is private too. Your team never sees
                it.
              </InlineNotification>
              <NeverSees
                heading="You never see"
                items={[
                  "Anyone's course progress",
                  "Time anyone spent learning",
                  "Quiz scores",
                  "Anything they haven't shared",
                ]}
              />
            </div>
          ),
        },
      ]}
    />
  );
}
