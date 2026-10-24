"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import { api } from "@convex/_generated/api";
import { NeverSees } from "@/components/settings/NeverSees";
import { ProfileTab } from "@/components/settings/ProfileTab";
import {
  REMINDER_ROWS,
  ToggleList,
  type ToggleRow,
} from "@/components/settings/ToggleList";
import { SettingsFrame } from "@/components/settings/SettingsFrame";

const sharingRows = (threshold: number): ToggleRow[] => [
  {
    key: "askBeforeSharing",
    label: "Ask me before anything is shared",
    description: "Nothing reaches your team or manager without your say-so.",
  },
  {
    key: "reflectionsOnCredential",
    label: "Add applied reflections to my credential",
    description: "Shown only on credential links you share.",
  },
  {
    // S-c and S-b: the cost of a change is said where it is made (Ruling FX).
    key: "includeInTeamTotals",
    label: "Include me in team totals",
    description: `Always anonymous. Hidden when fewer than ${threshold} people respond. Changing this during a sprint hides the rest of that sprint's team totals.`,
  },
];

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
      defaultTab="privacy"
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
          label: "Privacy and sharing",
          content: (
            <div className="grid max-w-[936px] grid-cols-[minmax(0,1fr)_300px] gap-07 max-[900px]:grid-cols-1">
              <ToggleList
                rows={sharingRows(mine.threshold)}
                values={mine.settings}
              />
              <div className="pt-05">
                <NeverSees
                  heading="Your manager and team never see"
                  items={[
                    "Your course progress",
                    "Time you spent learning",
                    "Quiz scores",
                    "Anything you haven't shared",
                  ]}
                />
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
