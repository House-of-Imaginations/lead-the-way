"use client";

import {
  Calendar,
  Catalog,
  Certificate,
  ChartColumn,
  Dashboard,
  DocumentTasks,
  Education,
  Home,
  Portfolio,
  PresentationFile,
  type CarbonIconType,
} from "@carbon/icons-react";
import { useConvex, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { usePathname } from "next/navigation";
import { Suspense, createContext, useContext, type ReactNode } from "react";
import {
  InlineNotification,
  SideNav,
  TopBar,
  type MenuItem,
  type SideNavProps,
} from "@/components/ui";
import { api } from "@convex/_generated/api";
import type { Shell } from "@convex/lib/shell";
import { authClient } from "@/lib/account/auth-client";
import type { NavState } from "@/lib/navState";
import { MovedToast } from "./MovedToast";

type NavIcon = Shell["nav"][number]["links"][number]["icon"];
// Type-only import of Shell: no Convex server code reaches the client bundle.
const ICONS: Record<NavIcon, CarbonIconType> = {
  Dashboard,
  Calendar,
  DocumentTasks,
  ChartColumn,
  Education,
  Catalog,
  Home,
  Portfolio,
  PresentationFile,
  Certificate,
};

const ExpectOrgId = createContext<Shell["expectOrgId"] | null>(null);

/**
 * The workspace this page was rendered for (R6). Product forms echo it on
 * every mutation. It never follows the live shell: a switch in another tab
 * must make a stale form fail, not quietly aim it at the other workspace.
 */
export function useExpectOrgId() {
  const id = useContext(ExpectOrgId);
  if (!id) throw new Error("useExpectOrgId needs the AppShell above it.");
  return id;
}

/** The signed-in shell. The (app) layout renders the demo banner above it. */
export function AppShell({
  initial,
  navState,
  children,
}: {
  initial: Shell;
  navState: NavState | null;
  children: ReactNode;
}) {
  // Ruling 17: live, starting from the server's copy (and kept through a
  // sign-out). A live shell for another workspace (switched in another tab)
  // is not shown: the page stays the one it was rendered for.
  const live = useQuery(api.viewer.shell, {});
  const switched = !!live && live.expectOrgId !== initial.expectOrgId;
  const shell = (!switched && live) || initial;
  const pathname = usePathname();
  const convex = useConvex();
  const setActiveOrg = useMutation(api.profiles.setActiveOrg);

  // Exact path, first match: "/manager" and "/manager#resources" share a path.
  const currentHref = shell.nav
    .flatMap((section) => section.links)
    .find((l) => l.href.split("#")[0] === pathname)?.href;

  // Switching persona or workspace and signing out all end in a full load, on
  // purpose: the server layout reads the new session and paints its shell and banner.
  // R2 and spec 6: the demo password comes from a DEMO_MODE-gated query, never the bundle.
  // Anything that fails ends at log in, never silently where it started.
  async function switchPersona(email: string) {
    let to = "/login";
    try {
      const password = await convex.query(api.demo.personaPassword, {});
      if (password) {
        await authClient.signOut();
        const { error } = await authClient.signIn.email({ email, password });
        if (!error) to = "/home";
      }
    } catch {
      // A rejection ends at log in too.
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
    window.location.assign(to);
  }

  const orgMenu: MenuItem[] = [
    ...shell.workspaces
      .filter((w) => !w.current)
      .map((w) => ({
        label: `Switch to ${w.name}`,
        // Home either way: a refused switch lands on the workspace still open.
        onSelect: () =>
          void setActiveOrg({ orgId: w.id })
            .catch(() => null)
            .then(() =>
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
              window.location.assign("/home"),
            ),
      })),
    // Ruling 18: the employee's disabled item waits for P7's settings pages.
    ...(shell.area === "manager"
      ? [{ label: "Workspace settings", href: "/workspace/settings" }]
      : []),
  ];
  const switchTo = shell.switchTo;
  const accountMenu: MenuItem[] = [
    ...(switchTo
      ? [
          {
            label: switchTo.label,
            onSelect: () => void switchPersona(switchTo.email),
          },
        ]
      : []),
    {
      label: "Sign out",
      // /signed-out drops the cookies and goes to log in, so a sign-out that
      // failed on the server still ends signed out here.
      onSelect: () =>
        void authClient
          .signOut()
          .catch(() => null)
          .then(() =>
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load, above
            window.location.assign("/signed-out"),
          ),
    },
  ];

  // Ruling: a person who isn't a manager gets the neutral avatar.
  const user = { ...shell.user, manager: shell.area === "manager" };
  const nav: SideNavProps = {
    homeHref: shell.home,
    org: shell.org,
    orgMenu: orgMenu.length > 0 ? orgMenu : undefined,
    sections: shell.nav.map((section) => ({
      title: section.title,
      links: section.links.map((l) => ({
        label: l.label,
        href: l.href,
        icon: ICONS[l.icon],
        current: l.href === currentHref,
      })),
    })),
    checklist: shell.checklist,
    status: shell.status,
    user,
    accountMenu,
  };

  return (
    <div className="group/shell flex min-h-0 flex-1 flex-col">
      <div className="md:hidden">
        <TopBar homeHref={shell.home} user={user} accountMenu={accountMenu}>
          <SideNav {...nav} resizable={false} />
        </TopBar>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <SideNav {...nav} initialState={navState} />
        </div>
        <main className="flex min-w-0 flex-1 flex-col gap-07 overflow-y-auto p-05 md:p-07">
          {switched && (
            <div role="status">
              <InlineNotification>
                You switched workspace in another tab. Reload the page to
                continue.
              </InlineNotification>
            </div>
          )}
          <ExpectOrgId value={initial.expectOrgId}>{children}</ExpectOrgId>
          {/* The disclaimer must be on every surface. The expanded nav carries it; the rail hides
              every label, so here it shows on phones (no side nav) and beside the rail. */}
          <p className="mt-auto text-label-01 text-text-helper md:hidden md:group-has-[.ltw-sn-col]/shell:block">
            Concept prototype. Not an official IBM product.
          </p>
        </main>
      </div>
      <Suspense>
        <MovedToast />
      </Suspense>
    </div>
  );
}
