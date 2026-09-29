"use client";

import { Tabs as RadixTabs } from "radix-ui";
import type { ReactNode } from "react";

export type TabItem = { value: string; label: string; content: ReactNode };
export type TabsProps = {
  label: string;
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
}: TabsProps) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={onValueChange}
    >
      <RadixTabs.List className="ltw-tabs" aria-label={label}>
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className="ltw-tab"
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content
          key={item.value}
          value={item.value}
          className="ltw-tabpanel"
        >
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
