import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Credential } from "@/components/app/Credential";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Credential · Lead the Way",
  robots: { index: false },
};

/**
 * Spec 7.1: the public credential, outside the app shell. `fetchQuery`, not
 * `fetchAuthQuery` (getAuthMethods' precedent): this read needs no identity,
 * so it sends none and a stale cookie can't reach it. The proxy already leaves
 * /credential public.
 */
export default async function PublicCredentialPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // No openOrHome: it only redirects a closed workspace, and a public read has none.
  const credential = await fetchQuery(api.badges.publicBySlug, { slug });
  if (credential === null) notFound();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text-primary">
      <header className="flex min-h-control-lg flex-wrap items-center justify-between gap-x-05 border-b border-border-subtle px-05">
        <p className="flex items-center gap-[10px] text-body-emphasis">
          <Logo />
          Lead the Way
        </p>
        <p className="text-body-02 text-text-secondary">
          Shared by {credential.holder}
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-content-max flex-1 flex-col gap-07 p-07 max-[671px]:p-05">
        <div className="flex flex-col gap-03">
          <h1 className="text-heading-01">{credential.holder}</h1>
          <p className="text-body-01 text-text-secondary">
            An IBM SkillsBuild badge, with evidence of how it was used at work.
          </p>
        </div>
        <Credential credential={credential} />
      </main>
      <footer className="border-t border-border-subtle p-05">
        <p className="text-label-01 text-text-helper">
          Concept prototype. Not an official IBM product.
        </p>
      </footer>
    </div>
  );
}
