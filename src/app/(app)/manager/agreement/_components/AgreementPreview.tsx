import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";

export type AgreementPreviewProps = {
  teamName: string;
  dateLabel: string;
  reviewDate: string;
  tools: string[];
  neverIn: string[];
  checks: string[];
  escalation: string;
  contactName: string;
  managerInitials: string;
  /** False while the form differs from the saved version, so paper says Draft. */
  isSaved: boolean;
};

const NONE = "None chosen yet.";
// ponytail: eight signature blanks, the size of the demo team. They are lines on
// paper, not data; the signed list comes from P6.
const BLANKS = [1, 2, 3, 4, 5, 6, 7, 8];

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-02 border-t border-border-subtle pt-04">
      <h3 className="text-body-emphasis">{title}</h3>
      {children}
    </section>
  );
}

/** The one-page agreement. Text only goes in as React children, so markup is shown, never parsed. */
export function AgreementPreview({
  teamName,
  dateLabel,
  reviewDate,
  tools,
  neverIn,
  checks,
  escalation,
  contactName,
  managerInitials,
  isSaved,
}: AgreementPreviewProps) {
  return (
    <div data-print="agreement" className="flex flex-col gap-03">
      <article className="flex flex-col gap-05 border border-border-subtle bg-background p-[40px] text-text-primary">
        <header className="flex flex-col gap-02">
          <div className="flex items-center justify-between gap-05">
            <h2 className="text-heading-02">Our Team AI Agreement</h2>
            {/* On screen the page's own tag says Draft; paper needs its own. */}
            {isSaved ? null : (
              <span className="hidden print:block">
                <Tag>Draft</Tag>
              </span>
            )}
          </div>
          <p className="text-label-01 text-text-secondary">
            {teamName}, {dateLabel}
          </p>
        </header>
        <Part title="Tools we use">
          <p>{tools.length ? tools.join(", ") : NONE}</p>
        </Part>
        <Part title="What never goes in">
          <p>{neverIn.length ? neverIn.join(", ") : NONE}</p>
        </Part>
        <Part title="How we check outputs">
          {checks.length ? (
            <ul className="list-[square] pl-05">
              {checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p>{NONE}</p>
          )}
        </Part>
        <Part title="When and who to ask">
          <p className="whitespace-pre-line">{escalation}</p>
          <p>Ask {contactName}.</p>
        </Part>
        <blockquote className="bg-highlight p-05 text-body-01">
          Using AI here is normal. Tell us what works, what fails and what you
          learn.
        </blockquote>
        <div className="flex flex-col gap-03">
          <p className="text-label-01 text-text-secondary">
            Signed by the team, including the manager
          </p>
          <div className="flex flex-wrap gap-02">
            <Avatar initials={managerInitials} />
            {BLANKS.map((n) => (
              <span
                key={n}
                aria-hidden="true"
                className="size-control-sm border border-dashed border-border-strong"
              />
            ))}
          </div>
        </div>
      </article>
      <p className="text-label-01 text-text-secondary">
        Team members sign when they join.
        {/* reviewDate is "" until a sprint exists. */}
        {reviewDate ? ` Review date ${reviewDate}.` : null}
      </p>
      <p className="hidden text-label-01 text-text-secondary print:block">
        Concept prototype. Not an official IBM product.
      </p>
    </div>
  );
}
