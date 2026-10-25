"use client";

import {
  Calendar,
  Certificate,
  Locked,
  Map as MapIcon,
  UserMultiple,
} from "@carbon/icons-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  SideNav,
  TopBar,
  type MenuItem,
  type SideNavProps,
} from "@/components/ui";
import { authClient } from "@/lib/account/auth-client";
import type { CareersShellData } from "@/lib/careers/shell";
import { CareersHeader } from "./CareersHeader";

/** Flow screens get the back arrow and their title on a phone (spec 6.1). */
const FLOW: Record<string, { title: string; back: string }> = {
  "/careers/crew/join": { title: "Join a crew", back: "/careers/map" },
  "/careers/crew/hours": {
    title: "Protect your hours",
    back: "/careers/crew/join",
  },
};

const LINKS = [
  { label: "My map", href: "/careers/map", icon: MapIcon },
  { label: "This week", href: "/careers/week", icon: Calendar },
  // Joined or not, the crew's page is its agreement (D3, D5).
  { label: "My crew", href: "/careers/crew/join", icon: UserMultiple },
  { label: "Proof", href: "/careers/proof", icon: Certificate },
];

/**
 * The signed-in Change careers shell: the careers side nav from 1056px, and
 * below it the dark careers header with the same nav in its drawer.
 */
export function CareersShell({
  data,
  children,
}: {
  data: CareersShellData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Demo day sits under My crew.
  const section = pathname.startsWith("/careers/crew/")
    ? "/careers/crew/join"
    : pathname;
  const user = {
    ...data.user,
    role: data.switcher ? "Two tracks" : "Career changer",
  };
  const accountMenu: MenuItem[] = [
    ...(data.hasTeam ? [{ label: "Home", href: "/home" }] : []),
    { label: "Privacy and settings", href: "/careers/settings" },
    {
      label: "Become a guide",
      disabled: true,
      helper: "After your first credential",
    },
    {
      label: "Log out",
      onSelect: () =>
        void authClient
          .signOut()
          .catch(() => null)
          .then(() =>
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, as AppShell does
            window.location.assign("/signed-out"),
          ),
    },
  ];
  const nav: SideNavProps = {
    brand: "Pivot Crews",
    homeHref: "/careers/week",
    org: {
      initials: "",
      name: data.target ?? "Change careers",
      team: data.from ? `from ${data.from}` : "Pivot Crews",
    },
    orgIcon: MapIcon,
    tracks: data.switcher
      ? { rows: data.switcher, selected: "career" }
      : undefined,
    sections: [
      {
        title: "Your path",
        links: LINKS.map((l) => ({ ...l, current: l.href === section })),
      },
      {
        title: "You",
        links: [
          {
            label: "Privacy and settings",
            href: "/careers/settings",
            icon: Locked,
            current: pathname === "/careers/settings",
          },
        ],
      },
    ],
    status: {
      heading: null,
      progress: null,
      label: "Next crew check-in",
      value: data.checkIn ?? "Once you join a crew",
      note: "Your employer never sees this plan",
    },
    user,
    accountMenu,
  };
  const flow = FLOW[pathname];

  return (
    <div className="group/shell flex min-h-dvh bg-background text-text-primary">
      <div className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start">
        <SideNav {...nav} initialState={data.navState} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          {flow ? (
            <CareersHeader title={flow.title} back={flow.back} />
          ) : (
            <TopBar
              dark
              brand="Pivot Crews"
              homeHref="/careers/week"
              user={user}
              accountMenu={accountMenu}
            >
              <SideNav {...nav} resizable={false} />
            </TopBar>
          )}
        </div>
        {children}
        {/* The expanded nav carries the disclaimer; the rail hides every label, so it shows here on phones and beside the rail. */}
        <p className="px-05 pb-05 text-label-01 text-text-helper lg:hidden lg:px-07 lg:group-has-[.ltw-sn-col]/shell:block">
          Concept prototype. Not an official IBM product.
        </p>
      </div>
    </div>
  );
}
