"use client";

import { Close, Menu as MenuIcon } from "@carbon/icons-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Logo } from "./Logo";

export type TopBarProps = {
  homeHref: string;
  /** The drawer contents: the SideNav with resizable={false}. */
  children: ReactNode;
};

export function TopBar({ homeHref, children }: TopBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
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
        <Dialog.Content
          className="ltw-drawer"
          aria-describedby={undefined}
          // Following a link from the drawer (menus included, through React's portal bubbling) closes it.
          onClick={(e) => {
            if ((e.target as Element).closest("a")) setOpen(false);
          }}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Close className="ltw-modal-x" aria-label="Close menu">
            <Close size={20} aria-hidden="true" />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
