import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { AppShell } from "@/components/app/AppShell";
import { HourlyRefresh } from "@/components/app/HourlyRefresh";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { getToken } from "@/lib/account/auth-server";
import { currentHour, getAccountShell, getHome } from "@/lib/account/queries";
import { NAV_COOKIE, parseNav } from "@/lib/navState";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [token, all, jar] = await Promise.all([
    getToken(),
    getAccountShell(),
    cookies(),
  ]);
  const shell = all?.team ?? null;
  // No shell: a cookie Convex doesn't accept (Ruling 16), or no workspace yet
  // (R4). Only then ask where the person belongs, so a normal load reads once.
  if (shell === null) redirect((await getHome()) ?? "/signed-out");
  return (
    <div className="flex h-dvh flex-col">
      {/* Reduce motion before paint, as the theme does; AppShell keeps it live. */}
      {shell.reduceMotion && (
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute("data-reduce-motion","")`,
          }}
        />
      )}
      {/* R11: rendered on the server, so its role="status" never announces a change after load. */}
      {shell.isDemo && <DemoBanner workspace={shell.org.name} />}
      <ConvexClientProvider initialToken={token}>
        <AppShell
          initial={shell}
          hour={currentHour()}
          navState={parseNav(jar.get(NAV_COOKIE)?.value)}
          switcher={all?.switcher}
        >
          {children}
        </AppShell>
      </ConvexClientProvider>
      <HourlyRefresh />
    </div>
  );
}
