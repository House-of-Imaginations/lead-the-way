import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppSidebar } from "@/app/(app)/_components/app-sidebar";
import { AuthGate } from "@/app/(app)/_components/auth-gate";
import { SiteHeader } from "@/app/(app)/_components/site-header";
import { UnauthorizedGate } from "@/app/(app)/_components/unauthorized-gate";
import { isAuthenticated } from "@/lib/account/auth-server";
import {
  SIDEBAR_WIDTH_COOKIE,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

/**
 * The workspace shell, and the first real layout this route group has had --
 * `(app)` and `(landing)` were pure URL grouping, with every page mounting its
 * own copy of the old `Screen` band.
 *
 * That is the point of moving it here. The chrome is painted once, by the
 * layout, so a route's own loading state is a skeleton in the content area
 * rather than a whole second shell that has to agree with this one. The defect
 * `Screen`'s comments described -- the account roundel arriving late and
 * shifting the header -- stops being possible: the rail is already on screen
 * before the route's data is asked for.
 *
 * BOTH RAIL COOKIES ARE READ HERE, ON THE SERVER, which is the whole reason
 * this is not a client component. The collapsed state and the dragged width are
 * remembered per browser, and reading them in an effect instead would paint a
 * 240px open rail first and then snap -- on every navigation, for anyone who
 * had ever touched it.
 *
 * THE AUTH GATE IS TWO HALVES, both rendering rather than redirecting so the
 * URL survives for "Sign in" to return to. `isAuthenticated()` here catches a
 * request that arrives already signed out -- the crash this replaced was
 * every workspace page treating "no seat" and "no session" as the same thing
 * and sending a signed-out visitor into an authenticated-only query (see
 * `useActiveOrg` and `orgs/new`). It cannot catch signing out ON an `(app)`
 * page or the Back button restoring one from the router cache, which is what
 * `AuthGate` (a client component watching `useConvexAuth`) is for -- see
 * both files for the split.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    return (
      <Suspense fallback={null}>
        <UnauthorizedGate />
      </Suspense>
    );
  }

  const store = await cookies();
  const open = store.get("sidebar_state")?.value !== "false";
  const stored = Number(store.get(SIDEBAR_WIDTH_COOKIE)?.value);
  // A cookie is user-writable, so it is clamped rather than trusted: a hand-set
  // `sidebar_width=99999` would otherwise push the content off the screen with
  // no way back short of clearing site data.
  const width =
    Number.isFinite(stored) && stored > 0
      ? Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, stored))
      : null;

  return (
    <>
      <SidebarProvider
        defaultOpen={open}
        style={
          width === null
            ? undefined
            : ({ "--sidebar-width": `${width}px` } as React.CSSProperties)
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          {/* `min-w-0` because a flex child floors at its content width by
              default, and one wide table inside would push the rail off-screen
              instead of scrolling itself. */}
          <div className="@container/main flex min-w-0 flex-1 flex-col">
            <Suspense fallback={null}>
              <AuthGate>{children}</AuthGate>
            </Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
