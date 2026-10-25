import { ArrowRight, Certificate } from "@carbon/icons-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { initialsOf } from "@convex/lib/initials";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import {
  currentHour,
  getAccountShell,
  getHome,
  openOrHome,
} from "@/lib/account/queries";
import { earnedOn } from "@/lib/careers/format";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tag } from "@/components/ui/Tag";
import {
  AddToLinkedIn,
  Confidence,
  ShareProof,
} from "./_components/ProofControls";

export const metadata: Metadata = { title: "Proof · From Zero to Hero" };

const THREE_PARTS = [
  ["Badge", "I learned it"],
  ["Project", "I can do it"],
  ["Endorsement", "The field agrees"],
] as const;

const NOTE = "Endorsements describe what you can do. They never promise a job.";

/**
 * 6 and D6: the badge, the project with its reflection, the guide's
 * endorsement, the confidence measure and the shareable link. Before the
 * badge, the credential's progress. On a phone the two columns are one, in
 * the order of screen 6 (`contents` lets their children take that order).
 */
export default async function ProofPage() {
  const hour = currentHour();
  const all = await getAccountShell();
  if (!all?.career) redirect((await getHome()) ?? "/signed-out");
  const [proof, week, settings] = await Promise.all([
    openOrHome(() => fetchAuthQuery(api.careers.proof.mine, {})),
    openOrHome(() => fetchAuthQuery(api.careers.learning.thisWeek, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.careerSettings.mine, {})),
  ]);
  const badge = proof.badges.at(-1) ?? null;
  const credentialId = badge?.credentialId ?? week?.credentialId ?? null;
  const project =
    proof.project && proof.project.credentialId === credentialId
      ? proof.project
      : null;
  const endorsement =
    proof.endorsements.find((e) => e.credentialId === credentialId) ?? null;
  const confidence =
    proof.confidence.find((c) => c.credentialId === credentialId)?.value ??
    null;
  const slug = proof.links.find((l) => l.credentialId === credentialId)?.slug;

  const next = (
    <ButtonLink href="/careers/journey" icon={ArrowRight}>
      Next credential
    </ButtonLink>
  );

  return (
    <main className="flex flex-1 flex-col gap-07 px-05 pt-06 pb-07 lg:px-07 lg:py-07">
      <header className="flex flex-col gap-06 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-03">
          <h1 className="text-heading-01 text-balance">
            {badge ? "Credential earned" : "Your proof"}
          </h1>
          <p className="hidden text-body-01 text-text-secondary lg:block">
            Badge, project and endorsement: proof an employer can see.
          </p>
        </div>
        {badge && (
          <div className="hidden lg:flex">
            <AddToLinkedIn />
            {next}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-06 lg:grid lg:grid-cols-2 lg:items-start lg:gap-09">
        <div className="contents lg:flex lg:flex-col lg:gap-06">
          {badge ? (
            <section
              aria-label="Badge"
              className="order-1 flex items-center gap-05 bg-layer-01 p-05"
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
          ) : (
            <section
              aria-label="Credential progress"
              className="order-1 flex flex-col gap-05 bg-layer-01 p-05"
            >
              {week ? (
                <>
                  <span className="text-label-01 text-text-secondary">
                    Credential {week.credentialNumber} of {week.credentialCount}
                  </span>
                  <h2 className="text-heading-04">{week.credentialName}</h2>
                  <ProgressBar
                    label="Lessons done"
                    value={week.done}
                    max={week.total}
                    valueText={`${week.done} of ${week.total} lessons`}
                  />
                </>
              ) : (
                <h2 className="text-heading-04">No credential yet</h2>
              )}
              <p className="text-body-02 text-text-secondary">
                Your badge, project and endorsement appear here as you earn
                them.
              </p>
            </section>
          )}

          <dl className="order-3 grid grid-cols-3 gap-01 lg:hidden">
            {THREE_PARTS.map(([term, means]) => (
              <div key={term} className="flex flex-col bg-layer-01 p-04">
                <dt className="text-body-emphasis">{term}</dt>
                <dd className="text-label-01 text-text-secondary">{means}</dd>
              </div>
            ))}
          </dl>

          {endorsement && (
            <figure className="order-4 flex flex-col gap-04 border-l-[3px] border-border-inverse bg-layer-01 p-05">
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

          {badge && (
            <div className="order-5 flex flex-col lg:hidden">
              <AddToLinkedIn />
            </div>
          )}

          {credentialId && (
            <div className="order-6 border-t border-border-subtle pt-06">
              <Confidence credentialId={credentialId} initial={confidence} />
            </div>
          )}

          {badge && (
            <div className="order-7">
              <ShareProof
                credentialId={badge.credentialId}
                initialSlug={slug ?? null}
                reflectionOnProof={settings.settings.reflectionOnProof}
                addReflectionToProof={project?.addReflectionToProof ?? null}
              />
            </div>
          )}
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-06">
          {project && (
            <section
              aria-labelledby="proof-project"
              className="order-2 flex flex-col gap-05"
            >
              <div className="flex items-center justify-between gap-05">
                <h2
                  id="proof-project"
                  className="text-heading-04 lg:text-heading-03"
                >
                  {project.title ? `Project: ${project.title}` : "Your project"}
                </h2>
                {project.reviewed && <Tag color="green">Reviewed</Tag>}
              </div>
              <dl className="grid gap-x-06 gap-y-04 text-body-02 lg:grid-cols-[160px_1fr]">
                <dt className="text-text-secondary">The task</dt>
                <dd>{project.task}</dd>
                {project.whatIDid && (
                  <>
                    <dt className="text-text-secondary">What I did</dt>
                    <dd>{project.whatIDid}</dd>
                  </>
                )}
                {project.reflection && (
                  <>
                    <dt className="text-text-secondary">What I learned</dt>
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
          <p className="order-8 text-label-01 text-text-secondary">{NOTE}</p>
        </div>
      </div>

      {badge && (
        <div className="flex flex-col border-t border-border-subtle pt-06 lg:hidden">
          {next}
        </div>
      )}
    </main>
  );
}
