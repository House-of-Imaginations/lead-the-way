import { ArrowLeft, ViewOff } from "@carbon/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { InlineNotification } from "@/components/ui/InlineNotification";
import { Logo } from "@/components/ui/Logo";
import { Tag } from "@/components/ui/Tag";
import { getToken } from "@/lib/account/auth-server";
import { getAccountShell, getHome } from "@/lib/account/queries";
import { PrivateTrackForm } from "./_components/PrivateTrackForm";

export const metadata: Metadata = {
  title: "Start a private track · From Zero to Hero",
};

const KEPT_APART = [
  "Your Pivot Map and target career",
  "Your crew, your guide and check-ins",
  "Lessons, progress and proof",
  "That this track exists at all",
];

/**
 * MS3: a team-only account starts a private Change careers track (X3). Anyone
 * else goes to their own home: a career track already exists, or there is no
 * team to keep it apart from.
 */
export default async function PrivateTrackPage() {
  const [all, token] = await Promise.all([getAccountShell(), getToken()]);
  if (!all?.team || all.career) redirect((await getHome()) ?? "/signed-out");
  const { org, workspaceSettings } = all.team;
  const manager = workspaceSettings.owner?.split(" ")[0] ?? "Your manager";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex min-h-control-lg items-center gap-05 bg-layer-inverse px-05 text-text-inverse">
        <Link
          href="/home"
          aria-label="Back"
          className="flex size-control-lg items-center justify-center"
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
        <span className="text-body-emphasis">Private track</span>
        <Link href="/home" aria-label="From Zero to Hero" className="ml-auto">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-06 px-05 pt-06">
        <div className="flex flex-col items-start gap-04">
          <Tag>Private</Tag>
          <h1 className="text-heading-01">Start a private track</h1>
          <p className="text-body-02 text-text-secondary">
            Explore a career change at your own pace. It sits beside your team
            sprint and stays separate from it.
          </p>
        </div>
        <section aria-labelledby="kept-apart" className="flex flex-col gap-04">
          <h2 id="kept-apart" className="text-heading-04">
            Kept apart from {org.name}
          </h2>
          <ul className="flex flex-col gap-03 text-body-02">
            {KEPT_APART.map((item) => (
              <li key={item} className="flex items-center gap-03">
                <ViewOff aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <InlineNotification title="Your team sprint is unchanged.">
          {manager} still sees team totals only, and nothing from this track.
        </InlineNotification>
        <ConvexClientProvider initialToken={token}>
          <PrivateTrackForm />
        </ConvexClientProvider>
        <p className="pb-06 text-label-01 text-text-helper">
          Concept prototype. Not an official IBM product.
        </p>
      </main>
    </div>
  );
}
