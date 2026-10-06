"use client";

import { Tabs as RadixTabs } from "radix-ui";
import { useState, type ReactNode } from "react";

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
  const [picked, setPicked] = useState(defaultValue ?? items[0]?.value);
  const wanted = value ?? picked;
  // A tab can go while selected (18 losing members:manage on Members): show
  // the first one left rather than a blank panel.
  const shown = items.some((i) => i.value === wanted)
    ? wanted
    : items[0]?.value;
  return (
    <RadixTabs.Root
      value={shown}
      onValueChange={(next) => {
        setPicked(next);
        onValueChange?.(next);
      }}
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
