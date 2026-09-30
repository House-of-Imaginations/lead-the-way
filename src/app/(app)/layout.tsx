import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { AppShell } from "@/components/app/AppShell";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { getToken } from "@/lib/account/auth-server";
import { getHome, getShell } from "@/lib/account/queries";
import { NAV_COOKIE, parseNav } from "@/lib/navState";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [token, home, shell, jar] = await Promise.all([
    getToken(),
    getHome(),
    getShell(),
    cookies(),
  ]);
  // A cookie Convex doesn't accept (Ruling 16), then no workspace yet (R4).
  if (home === null) redirect("/signed-out");
  if (shell === null) redirect(home);
  return (
    <div className="flex h-dvh flex-col">
      {/* R11: rendered on the server, so its role="status" never announces a change after load. */}
      {shell.isDemo && <DemoBanner workspace={shell.org.name} />}
      <ConvexClientProvider initialToken={token}>
        <AppShell
          initial={shell}
          navState={parseNav(jar.get(NAV_COOKIE)?.value)}
        >
          {children}
        </AppShell>
      </ConvexClientProvider>
    </div>
  );
}
