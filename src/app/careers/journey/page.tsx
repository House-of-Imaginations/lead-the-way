import { ArrowRight } from "@carbon/icons-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { getAccountShell, getHome } from "@/lib/account/queries";

export const metadata: Metadata = { title: "Your journey" };

/**
 * `viewer.home` for a career track. ponytail: a holding page so sign-up and
 * MS2 land somewhere real; P13b replaces it with screen 4.
 */
export default async function JourneyPage() {
  const all = await getAccountShell();
  if (!all?.career) redirect((await getHome()) ?? "/signed-out");
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-06 bg-background px-05 py-07 text-text-primary">
      <span className="flex items-center gap-[10px] text-body-emphasis">
        <Logo />
        Pivot Crews
      </span>
      <h1 className="text-heading-01 font-light text-balance">
        Your map is saved
      </h1>
      <p className="text-body-01 text-text-secondary">
        Next, you join a crew heading the same way, with a guide. Your crew and
        this week&apos;s plan open here soon.
      </p>
      {all.team && (
        <ButtonLink href="/home" icon={ArrowRight} className="w-full">
          Go to home
        </ButtonLink>
      )}
      <p className="mt-auto text-label-01 text-text-helper">
        Concept prototype. Not an official IBM product.
      </p>
    </main>
  );
}
