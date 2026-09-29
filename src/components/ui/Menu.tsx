"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import type { ReactElement } from "react";

export type MenuItem = {
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** A second line, e.g. why the item is disabled. */
  helper?: string;
};
export type MenuProps = {
  trigger: ReactElement;
  items: MenuItem[];
  side?: "top" | "bottom";
  align?: "start" | "end";
};

export function Menu({
  trigger,
  items,
  side = "bottom",
  align = "start",
}: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="ltw-menu"
          side={side}
          align={align}
          sideOffset={4}
        >
          {items.map((item, i) => {
            const body = (
              <>
                {item.label}
                {item.helper && <span className="ltw-help">{item.helper}</span>}
              </>
            );
            return item.href && !item.disabled ? (
              <DropdownMenu.Item key={i} asChild textValue={item.label}>
                <Link href={item.href} className="ltw-menu-i">
                  {body}
                </Link>
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                key={i}
                className="ltw-menu-i"
                disabled={item.disabled}
                onSelect={item.onSelect}
                textValue={item.label}
              >
                {body}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
