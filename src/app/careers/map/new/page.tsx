import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { CareersHeader } from "@/components/careers/CareersHeader";
import { openOrHome } from "@/lib/account/queries";
import { draftToken } from "@/lib/careers/draftCookie";
import { TellUsForm } from "./_components/TellUsForm";

export const metadata: Metadata = { title: "Your Pivot Map" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 2 Tell us about you: the answers become an anonymous draft (P9). */
export default async function TellUsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [{ partner }, token] = await Promise.all([searchParams, draftToken()]);
  const slug = typeof partner === "string" && partner ? partner : undefined;
  const draft = token
    ? await openOrHome(() => fetchQuery(api.careers.drafts.get, { token }))
    : null;
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text-primary">
      <CareersHeader
        title="Your Pivot Map"
        back={slug ? `/p/${encodeURIComponent(slug)}` : "/start"}
      />
      <TellUsForm partner={slug} draft={draft} />
    </div>
  );
}
