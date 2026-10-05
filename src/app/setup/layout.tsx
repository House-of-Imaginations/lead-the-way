import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { HourlyRefresh } from "@/components/app/HourlyRefresh";
import { MovedToast } from "@/components/app/MovedToast";
import { SetupHeader } from "@/components/app/SetupHeader";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { getToken } from "@/lib/account/auth-server";
import { getHome, getShell } from "@/lib/account/queries";

/**
 * Setup flows drop the side nav (DESIGN.md, Layout). 03 and 04 use the full
 * width for their two columns (Ruling 11); /setup/start keeps the 900px column
 * itself. `main` has no bottom padding, so the pages' 64px footer sits flush.
 */
export default async function SetupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [token, shell] = await Promise.all([getToken(), getShell()]);
  // No shell: no workspace yet, or a cookie Convex doesn't accept (Ruling 16).
  // Only then ask whether the session is real, so a normal load reads once.
  if (shell === null && (await getHome()) === null) redirect("/signed-out");
  return (
    <div className="flex min-h-dvh flex-col">
      {/* R11: rendered on the server, so its role="status" never announces a change after load. */}
      {shell?.isDemo && <DemoBanner workspace={shell.org.name} />}
      <SetupHeader home={shell?.home ?? "/"} />
      <ConvexClientProvider initialToken={token}>
        <main className="flex w-full flex-1 flex-col gap-07 px-10 pt-07 max-md:px-05">
          {children}
        </main>
      </ConvexClientProvider>
      {/* Ruling 9: a role redirect can land here (a manager's home is /setup/team until the team is saved). */}
      <Suspense>
        <MovedToast />
      </Suspense>
      <HourlyRefresh />
    </div>
  );
}
