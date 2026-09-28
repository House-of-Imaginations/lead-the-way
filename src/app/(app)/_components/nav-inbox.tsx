"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { Inbox } from "lucide-react";
import { badgeCount } from "@/lib/inbox";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * The Inbox row, above the workspace nav because it is the person's and not
 * the workspace's.
 *
 * Unread shows twice on purpose. The count sits at the row's end, and the
 * sidebar hides it in the 56px icon rail; the red dot on the glyph is what
 * survives there. Neither is the only signal: the link's accessible name and
 * the rail's tooltip both say "3 unread" in words.
 */
export function NavInbox() {
  const pathname = usePathname();
  const { isAuthenticated } = useConvexAuth();
  const count = useQuery(api.inbox.unreadCount, isAuthenticated ? {} : "skip");
  const unread = count ? `${count} unread` : null;

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/inbox"}
              tooltip={unread ? `Inbox, ${unread}` : "Inbox"}
              className="relative"
            >
              <Link href="/inbox">
                <Inbox />
                {unread && (
                  <span
                    aria-hidden
                    // On the glyph's top-right corner, cut out of whatever
                    // ground the row is on so it reads over the icon's stroke.
                    className="absolute top-1.5 left-[18px] size-2 rounded-full bg-destructive ring-2 ring-sidebar [:hover>&]:ring-sidebar-accent [[data-active=true]>&]:ring-sidebar-accent"
                  />
                )}
                <span>
                  Inbox
                  {unread && <span className="sr-only">, {unread}</span>}
                </span>
              </Link>
            </SidebarMenuButton>
            {count ? (
              <SidebarMenuBadge aria-hidden>
                {badgeCount(count)}
              </SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
