import { Tabs, type TabItem } from "@/components/ui";

/** 17 and 19: the page title, its lead and the tabs (spec 7.2). */
export function SettingsFrame({
  lead,
  tabs,
  defaultTab,
}: {
  lead: string;
  tabs: TabItem[];
  defaultTab?: string;
}) {
  return (
    <div className="flex max-w-[936px] flex-col gap-07">
      <header className="flex flex-col gap-03">
        <h1 className="text-heading-01 text-balance">Settings</h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">{lead}</p>
      </header>
      <Tabs label="Settings" items={tabs} defaultValue={defaultTab} />
    </div>
  );
}
