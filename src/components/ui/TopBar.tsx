"use client";

import { Close, Menu as MenuIcon } from "@carbon/icons-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Logo } from "./Logo";
import { Menu, type MenuItem } from "./Menu";

export type TopBarProps = {
  homeHref: string;
  /** The signed-in person: their avatar opens the account menu, as the side nav's does. */
  user: { initials: string; name: string; manager?: boolean };
  accountMenu: MenuItem[];
  /** The drawer contents: the SideNav with resizable={false}. */
  children: ReactNode;
  /** The careers bar reads "From Zero to Hero" on the dark careers header (spec 6.1). */
  brand?: string;
  dark?: boolean;
};

/** M2: menu on the left, then the brand, then the person's avatar on the right. */
export function TopBar({
  homeHref,
  user,
  accountMenu,
  children,
  brand = "From Zero to Hero",
  dark,
}: TopBarProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className={dark ? "ltw-tb ltw-ch" : "ltw-tb"}>
        <Dialog.Trigger aria-label="Open menu">
          <MenuIcon size={20} aria-hidden="true" />
        </Dialog.Trigger>
        <Link href={homeHref}>
          <Logo />
          {brand}
        </Link>
        <Menu
          align="end"
          items={accountMenu}
          trigger={
            <button
              type="button"
              className="ltw-tb-acct"
              aria-label={user.name}
              title={user.name}
            >
              <Avatar initials={user.initials} manager={user.manager} />
            </button>
          }
        />
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
