import { ArrowRight, Email } from "@carbon/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Partner email · From Zero to Hero",
  robots: { index: false },
};

const DETAILS = [
  [
    "From",
    "Southbank Business Collective <programs@southbankcollective.org.au>",
  ],
  ["To", "Priya Raman"],
  ["Date", "Tuesday 1 September 2026, 9:12 AM"],
] as const;

const OFFER = [
  [
    "60 min",
    "Leading AI in Your Team: safe use, checking outputs, supporting nervous learners",
  ],
  ["30 min", "One team conversation that ends with four shared AI rules"],
  [
    "4 x 1 hr",
    "A protected weekly hour to learn, apply it to real work and show what changed",
  ],
] as const;

/**
 * 01: the partner's invitation, as Priya's inbox shows it. Static on purpose
 * (Ruling 15): no Convex, no provider, readable signed out.
 */
export default function PartnerEmailPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-layer-01">
      <header className="flex min-h-control-lg flex-wrap items-center justify-between gap-x-05 border-b border-border-subtle bg-background px-06 max-md:px-05">
        <span className="flex items-center gap-04">
          <Email size={16} aria-hidden="true" />
          Inbox
        </span>
        <p className="text-label-01 text-text-secondary">
          Concept prototype. Not an official IBM product.
        </p>
      </header>
      <main className="flex flex-col items-center gap-05 px-05 pt-06 pb-09">
        <section
          aria-label="Message details"
          className="w-full max-w-[640px] border border-border-subtle bg-background p-05"
        >
          <p className="pb-03 text-heading-03">
            Lead your team into AI. Free, 4 weeks, with SkillsBuild.
          </p>
          <dl>
            {DETAILS.map(([term, value]) => (
              <div
                key={term}
                className="grid grid-cols-[72px_minmax(0,1fr)] gap-05 border-t border-border-subtle py-04"
              >
                <dt className="text-text-secondary">{term}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <article className="w-full max-w-[640px] border border-border-subtle bg-background">
          <div className="flex items-center justify-between gap-05 border-b border-border-subtle px-05 py-05 md:px-[40px]">
            <span className="flex items-center gap-[10px]">
              <span
                aria-hidden="true"
                className="grid size-06 place-items-center bg-layer-01 text-label-01 font-semibold"
              >
                SB
              </span>
              <span>Southbank Business Collective</span>
            </span>
            <span className="text-label-01 text-text-secondary">
              Member program
            </span>
          </div>
          <div className="flex flex-col gap-06 px-05 pt-09 pb-[40px] text-body-01 md:px-[40px]">
            <h1 className="text-display-03">Lead your team into AI</h1>
            <p>Hi Priya,</p>
            <p>
              As a member, your team can join From Zero to Hero: a free
              four-week AI sprint for managers and their teams, built on
              existing IBM SkillsBuild courses.
            </p>
            <p>
              It starts with you. You get a short manager path, a ready-made
              Team AI Agreement, and a plan to protect one working hour a week,
              so your team learns during work instead of after it.
            </p>
            <ul className="bg-layer-01 px-06 py-03">
              {OFFER.map(([time, what]) => (
                <li
                  key={time}
                  className="grid grid-cols-[96px_minmax(0,1fr)] gap-05 border-b border-border-subtle py-04 last:border-b-0 max-md:grid-cols-1 max-md:gap-02"
                >
                  <span className="tabular-nums">{time}</span>
                  <span className="text-body-02">{what}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/" icon={ArrowRight} className="self-start">
              Start the manager path
            </ButtonLink>
            <p className="text-body-02 text-text-secondary">
              Participation is voluntary and uses paid work time. Learning data
              is never used for performance review.
            </p>
          </div>
          <p className="bg-layer-01 px-05 py-06 text-label-01 text-text-secondary md:px-[40px]">
            Sent by Southbank Business Collective on behalf of the SkillsBuild
            partner program.{" "}
            {/* Underlined: link-in-text-block, the colours alone are under 3:1. */}
            <Link
              href="/"
              className="text-link underline hover:text-link-hover"
            >
              Unsubscribe
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
