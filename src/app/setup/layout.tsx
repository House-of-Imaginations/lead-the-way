import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Logo } from "@/components/ui/Logo";
import { getToken } from "@/lib/account/auth-server";
import { getHome, getShell } from "@/lib/account/queries";

/** Setup flows drop the side nav for a centred 900px column (DESIGN.md, Layout). */
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
      <header className="flex min-h-control-lg flex-wrap items-center gap-x-05 border-b border-border-subtle px-05">
        <Link
          href={shell?.home ?? "/"}
          className="flex items-center gap-[10px] text-body-emphasis"
        >
          <Logo />
          Lead the Way
        </Link>
        <span className="text-body-02 text-text-secondary">
          Set up your team sprint
        </span>
        <p className="ml-auto text-label-01 text-text-helper">
          Concept prototype. Not an official IBM product.
        </p>
      </header>
      <ConvexClientProvider initialToken={token}>
        <main className="mx-auto flex w-full max-w-setup-column flex-1 flex-col gap-07 px-05 py-07">
          {children}
        </main>
      </ConvexClientProvider>
    </div>
  );
}
