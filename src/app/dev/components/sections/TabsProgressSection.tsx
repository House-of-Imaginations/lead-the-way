import { Disclosure, ProgressBar, ProgressSteps, Tabs } from "@/components/ui";
import { Section } from "./Section";

export function TabsProgressSection() {
  return (
    <Section id="tabs-progress" title="Tabs, disclosure and progress">
      <div className="max-w-[720px]">
        <Tabs
          label="Settings sections"
          items={[
            {
              value: "profile",
              label: "Profile",
              content: <p>Your name, role and theme.</p>,
            },
            {
              value: "notifications",
              label: "Notifications",
              content: <p>Reminders before the protected hour.</p>,
            },
            {
              value: "privacy",
              label: "Privacy",
              content: (
                <p>
                  Your own pathway progress is private too. Your team never sees
                  it.
                </p>
              ),
            },
          ]}
        />
      </div>
      <Disclosure summary="Why can't I see individual progress?">
        Lead the Way shows you team totals only. Individual course activity,
        time spent and scores stay private to each person, so learning feels
        safe. Projects appear only when their owner chooses to present them.
      </Disclosure>
      <div className="max-w-[480px]">
        <ProgressBar
          label="Joined the sprint"
          value={5}
          max={8}
          valueText="5 of 8 teammates"
        />
      </div>
      <ProgressSteps
        label="Setup progress"
        current={1}
        steps={[
          { label: "Your team", helper: "2 minutes" },
          { label: "Protected hour", helper: "1 minute" },
          { label: "Manager pathway", helper: "25 minutes" },
          { label: "Invite team", helper: "2 minutes" },
        ]}
      />
    </Section>
  );
}
