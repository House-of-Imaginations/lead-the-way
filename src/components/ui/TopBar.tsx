"use client";

import { Menu as MenuIcon } from "@carbon/icons-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export type TopBarProps = {
  homeHref: string;
  /** The drawer contents: the SideNav with resizable={false}. */
  children: ReactNode;
};

export function TopBar({ homeHref, children }: TopBarProps) {
  return (
    <Dialog.Root>
      <header className="ltw-tb">
        <Link href={homeHref}>
          <Logo />
          Lead the Way
        </Link>
        <Dialog.Trigger aria-label="Open menu">
          <MenuIcon size={20} aria-hidden="true" />
        </Dialog.Trigger>
      </header>
      <Dialog.Portal>
        <Dialog.Overlay className="ltw-scrim ltw-scrim-fixed" />
        <Dialog.Content className="ltw-drawer" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
