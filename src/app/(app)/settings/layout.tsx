"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "convex-helpers/react/cache";
import { api } from "@convex/_generated/api";
import { Plate } from "@/components/kit/Plate";
import { PageBody, PagePending } from "@/app/(app)/_components/page-body";
import { useRedirectIfDeleting } from "@/hooks/useRedirectIfDeleting";

/**
 * What every settings page needs before it can draw: somebody signed in, whose
 * account is not on its way out. Held here once rather than in each of the
 * three pages, so none of them can forget the deletion redirect.
 *
 * The pages read `getCurrentUser` again for what they display; the query cache
 * shares the one subscription.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useQuery(api.auth.getCurrentUser, {});
  const deletion = useQuery(api.account.deletionStatus, {});

  useRedirectIfDeleting(deletion);

  if (user === undefined) return <PagePending />;

  if (user === null) {
    return (
      <PageBody>
        <h1 className="display text-[38px] text-foreground">Settings</h1>
        <p className="text-[15px] leading-snug text-muted-foreground">
          These are the settings for an account, and this browser is not signed
          in to one.
        </p>
        <Plate
          variant="action"
          center
          href={`/sign-in?redirect=${encodeURIComponent(pathname)}`}
          label="Sign in"
        />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <div className="flex w-full flex-col gap-8">{children}</div>
    </PageBody>
  );
}
