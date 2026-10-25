import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { Logo } from "@/components/ui/Logo";
import { getToken } from "@/lib/account/auth-server";
import { getHome, getShell } from "@/lib/account/queries";

const DISCLAIMER = "Concept prototype. Not an official IBM product.";

/**
 * The four guides (MASTER_PROMPT 8). Private (G-a): the proxy sends a
 * signed-out visitor to log in. Any signed-in session may read them, seated,
 * career-only or neither (Review Focus 1): only a cookie Convex rejects goes
 * to /signed-out.
 */
export default async function GuideLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [token, shell] = await Promise.all([getToken(), getShell()]);
  if (shell === null && (await getHome()) === null) redirect("/signed-out");
  return (
    <ConvexClientProvider initialToken={token}>
      {/* R7: a 40px background bar, not Main.png's dark strip. */}
      <header className="flex min-h-control-md flex-wrap items-center justify-between gap-x-05 border-b border-border-subtle px-05 md:px-07">
        <Link
          href="/guide"
          className="flex items-center gap-[10px] text-body-02 text-text-primary"
        >
          <Logo />
          <span className="font-semibold">From Zero to Hero</span>
          <span className="text-text-secondary">Prototype guide</span>
        </Link>
        <span className="text-label-01 text-text-secondary">{DISCLAIMER}</span>
      </header>
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-05 py-09 md:px-10">
        {children}
      </main>
    </ConvexClientProvider>
  );
}
