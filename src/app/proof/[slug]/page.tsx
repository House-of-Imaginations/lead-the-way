import { Certificate } from "@carbon/icons-react";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { api } from "@convex/_generated/api";
import { initialsOf } from "@convex/lib/initials";
import { earnedOn } from "@/lib/careers/format";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { Tag } from "@/components/ui/Tag";

type Params = Promise<{ slug: string }>;

const LEAD = "Badge, project and endorsement: proof of what they can do.";

/** One read per request, shared by the metadata and the page. */
const proofBySlug = cache((slug: string) =>
  fetchQuery(api.careers.proof.publicProof, { slug }),
);

/** Text-only Open Graph, as `/credential/[slug]`: a name, no image, not indexed. */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const proof = await proofBySlug((await params).slug);
  const robots = { index: false };
  if (proof === null) return { title: "Proof · From Zero to Hero", robots };
  const title = `${proof.firstName}'s proof`;
  return {
    title: `${title} · From Zero to Hero`,
    description: LEAD,
    robots,
    openGraph: { title, description: LEAD, type: "website" },
    twitter: { card: "summary", title, description: LEAD },
  };
}

/**
 * The public proof page (P5), signed out: `fetchQuery`, so no identity is
 * sent. The badge, the project's task and skills, the endorsement, and the
 * reflection only when the learner turned both switches on. The proxy leaves
 * /proof public.
 */
export default async function PublicProofPage({ params }: { params: Params }) {
  const { slug } = await params;
  // No openOrHome, as `/credential/[slug]`: a public read has no workspace.
  const proof = await proofBySlug(slug);
  if (proof === null) notFound();
  const { badge, project, endorsement } = proof;
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text-primary">
      <header className="flex min-h-control-lg flex-wrap items-center justify-between gap-x-05 border-b border-border-subtle px-05">
        <p className="flex items-center gap-[10px] text-body-emphasis">
          <Logo />
          From Zero to Hero
        </p>
        <p className="text-body-02 text-text-secondary">
          Shared by {proof.firstName}
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col gap-07 p-07 max-[672px]:p-05">
        <div className="flex flex-col gap-03">
          <h1 className="text-heading-01">{proof.firstName}</h1>
          <p className="text-body-01 text-text-secondary">{LEAD}</p>
        </div>
        <section
          aria-label="Badge"
          className="flex items-center gap-05 bg-layer-01 p-05"
        >
          <span
            aria-hidden="true"
            className="flex size-[72px] shrink-0 items-center justify-center bg-interactive text-text-on-color"
          >
            <Certificate size={32} />
          </span>
          <div className="flex flex-col gap-02">
            <span className="text-label-01 text-text-secondary">
              IBM SkillsBuild badge
            </span>
            <h2 className="text-heading-04">{badge.name}</h2>
            <span className="text-label-01 text-text-secondary">
              Earned {earnedOn(badge.earnedAt)}
            </span>
          </div>
        </section>
        {project && (
          <section
            aria-labelledby="proof-project"
            className="flex flex-col gap-05"
          >
            <h2 id="proof-project" className="text-heading-03">
              Project
            </h2>
            <dl className="grid gap-x-06 gap-y-04 text-body-02 min-[672px]:grid-cols-[160px_1fr]">
              <dt className="text-text-secondary">The task</dt>
              <dd>{project.task}</dd>
              {project.reflection && (
                <>
                  <dt className="text-text-secondary">What they learned</dt>
                  <dd>“{project.reflection}”</dd>
                </>
              )}
              {project.skills.length > 0 && (
                <>
                  <dt className="text-text-secondary">Skills shown</dt>
                  <dd className="flex flex-wrap gap-03">
                    {project.skills.map((s) => (
                      <Tag key={s}>{s}</Tag>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </section>
        )}
        {endorsement && (
          <figure className="flex flex-col gap-04 border-l-[3px] border-border-inverse bg-layer-01 p-05">
            <figcaption className="text-label-01 text-text-secondary">
              Guide endorsement
            </figcaption>
            <blockquote className="text-heading-03 font-light">
              “{endorsement.text}”
            </blockquote>
            <p className="flex items-center gap-04 text-body-02">
              <Avatar initials={initialsOf(endorsement.guide.firstName)} />
              {endorsement.guide.firstName}, Pathway Guide
            </p>
          </figure>
        )}
        <p className="text-label-01 text-text-secondary">
          Endorsements describe what someone can do. They never promise a job.
        </p>
      </main>
      <footer className="border-t border-border-subtle p-05">
        <p className="text-label-01 text-text-secondary">
          Concept prototype. Not an official IBM product.
        </p>
      </footer>
    </div>
  );
}
