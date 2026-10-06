import type { ReactNode } from "react";
import { Tabs, type TabItem } from "@/components/ui";

/** 17, 18 and 19: the page title, its lead, an optional tag and the tabs (spec 7.2). */
export function SettingsFrame({
  title = "Settings",
  lead,
  aside,
  tabs,
  defaultTab,
}: {
  title?: string;
  lead: string;
  /** Beside the title, as 18's "Owner: Priya Raman". */
  aside?: ReactNode;
  tabs: TabItem[];
  defaultTab?: string;
}) {
  return (
    <div className="flex max-w-[936px] flex-col gap-07">
      <header className="flex flex-wrap items-start justify-between gap-05">
        <div className="flex flex-col gap-03">
          <h1 className="text-heading-01 text-balance">{title}</h1>
          <p className="max-w-[65ch] text-body-01 text-text-secondary">
            {lead}
          </p>
        </div>
        {aside}
      </header>
      <Tabs label={title} items={tabs} defaultValue={defaultTab} />
    </div>
  );
}
