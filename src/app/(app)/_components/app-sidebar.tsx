"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSelectedLayoutSegments } from "next/navigation";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import {
  Bell,
  Building2,
  LayoutDashboard,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { NavInbox } from "@/app/(app)/_components/nav-inbox";
import { NavUser } from "@/app/(app)/_components/nav-user";
import { OrgSwitcher } from "@/app/(app)/_components/org-switcher";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { isNavActive, mainNav, type NavId } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

/**
 * The rail. `DESIGN.md` has asked for this shape all along -- "a fixed sidebar
 * at 240px collapsing to a 56px icon rail below 1024px and to an overlay drawer
 * below 640px" -- while the code shipped a 76px header band instead. This is
 * the spec's shell, on the spec's widths (`ui/sidebar.tsx` pins them).
 *
 * THE WORDMARK IS ON EVERY ROUTE WITHOUT EXCEPTION, which is the one rule the
 * band it replaces was built around. It is the fixed point; a shell that drops
 * it on one screen is the drift the band existed to end.
 */
const NAV_ICONS: Record<NavId, LucideIcon> = {
  dashboard: LayoutDashboard,
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const segments = useSelectedLayoutSegments();
  // Same guard and same fallback as `OrgSwitcher`: `orgs.mine` throws for a
  // guest, and the pane names the workspace the switcher shows -- the one in
  // the URL, else the first -- so the two never disagree.
  const user = useQuery(api.auth.getCurrentUser, {});
  const orgs = useQuery(api.orgs.mine, user ? {} : "skip");
  const urlSlug = segments[0] === "orgs" ? segments[1] : undefined;
  const slug =
    orgs?.find((org) => org.slug === urlSlug)?.slug ?? orgs?.[0]?.slug;

  const seat = useActiveOrg();
  const items = mainNav(seat?.permissions ?? []).map((n) => ({
    title: n.title,
    url: n.url,
    icon: NAV_ICONS[n.id],
  }));

  // One row per settings page.
  const settingsItems = [
    { title: "Profile", url: "/settings/profile", icon: UserRound },
    { title: "Notifications", url: "/settings/notifications", icon: Bell },
    { title: "Account", url: "/settings/account", icon: SlidersHorizontal },
    { title: "Restore", url: "/restore", icon: RotateCcw },
  ];

  // No workspace, no pane. A row that navigates to `/orgs/undefined/members`
  // is worse than no row.
  const workspaceItems = slug
    ? [
        { title: "Overview", url: `/orgs/${slug}`, icon: Building2 },
        { title: "Members", url: `/orgs/${slug}/members`, icon: Users },
        { title: "Roles", url: `/orgs/${slug}/roles`, icon: ShieldCheck },
      ]
    : [];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              // The rail's own `[&>svg]:size-4` would shrink the emblem to icon
              // size in the expanded sidebar too, where it is the identity and
              // not a list bullet. 20px expanded, 16px in the icon rail so it
              // lines up exactly with the nav glyphs under it.
              className="hover:bg-transparent [&>svg]:size-5 group-data-[collapsible=icon]:[&>svg]:size-4"
            >
              <Link href="/dashboard">
                {/* The emblem is what survives the 56px icon rail; the
                    wordmark beside it is hidden there by the sidebar's own
                    `group-data-[collapsible=icon]` rules. */}
                <BrandMark />
                {/* HIDDEN, not clipped, in the icon rail. The sidebar only sets
                    `overflow-hidden`, so a wordmark left in flow still takes its
                    width in the 56px rail and shoves the emblem off-centre --
                    which is what made the collapsed rail look crooked. */}
                <span className="text-[15px] font-semibold tracking-[-0.02em] text-institution group-data-[collapsible=icon]:hidden dark:text-foreground">
                  Lead the Way
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavInbox />
        {items.length > 0 ? (
          <NavGroup items={items} pathname={pathname} exact={false} />
        ) : null}
        {workspaceItems.length > 0 ? (
          <NavGroup
            label="Workspace"
            items={workspaceItems}
            pathname={pathname}
          />
        ) : null}
        <NavGroup label="Settings" items={settingsItems} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      {/* Drag to resize, click to collapse, arrow keys to nudge. */}
      <SidebarRail />
    </Sidebar>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  exact,
}: {
  label?: string;
  items: { title: string; url: string; icon: LucideIcon }[];
  pathname: string;
  exact?: boolean;
}) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                // Compared against the whole path rather than a prefix, so
                // `/orgs/acme` does not light `/orgs/acme/members` too.
                // The main group matches by prefix so a case page keeps Cases lit.
                isActive={
                  exact === false
                    ? isNavActive(pathname, item.url)
                    : pathname === item.url
                }
              >
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
