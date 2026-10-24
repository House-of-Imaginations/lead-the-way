import { Add, Certificate } from "@carbon/icons-react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import type { api } from "@convex/_generated/api";
import { Tag } from "@/components/ui/Tag";

/** What both credential pages show: `badges.mine` without its slug. `publicBySlug` adds `holder`. */
export type CredentialView = Omit<
  NonNullable<FunctionReturnType<typeof api.badges.mine>>,
  "slug"
>;

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[156px_minmax(0,1fr)] gap-05 border-b border-border-subtle py-04 last:border-b-0 max-[672px]:grid-cols-1 max-[672px]:gap-02">
      <dt className="text-body-02 text-text-secondary max-[672px]:text-label-01">
        {term}
      </dt>
      <dd className="text-body-02">{children}</dd>
    </div>
  );
}

/**
 * 15's two cards, for /me/credential and the public /credential/[slug]. No
 * hooks, so the public page renders it on the server. `empty` fills the
 * applied card when there is no reflection (only /me passes one).
 */
export function Credential({
  credential,
  empty,
}: {
  credential: CredentialView;
  empty?: ReactNode;
}) {
  const { reflection } = credential;
  return (
    <div className="grid grid-cols-[minmax(0,5fr)_24px_minmax(0,7fr)] max-[900px]:grid-cols-1 max-[900px]:gap-05">
      <section
        aria-labelledby="badge-title"
        className="flex flex-col bg-layer-01"
      >
        <div className="flex flex-1 items-start gap-05 p-06 max-[672px]:p-05">
          <div className="flex size-[96px] shrink-0 items-center justify-center bg-interactive text-text-on-color max-[672px]:size-[64px]">
            <Certificate size={32} aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-02">
            <p className="text-label-01 text-text-secondary">
              {credential.issuer} badge
            </p>
            <h2
              id="badge-title"
              className="text-heading-02 max-[672px]:text-heading-03"
            >
              {credential.name}
            </h2>
            <p className="text-body-02 text-text-secondary">
              {credential.completed}
            </p>
          </div>
        </div>
        <p className="bg-layer-selected px-06 py-05 text-heading-03 font-light max-[672px]:px-05 max-[672px]:py-04 max-[672px]:text-body-01">
          Badge = I learned it.
        </p>
      </section>

      <Add
        size={16}
        aria-hidden="true"
        className="self-center justify-self-center text-text-secondary max-[900px]:hidden"
      />

      <section
        aria-labelledby="applied-title"
        className="flex flex-col border border-interactive"
      >
        <div className="flex flex-1 flex-col gap-05 p-06 max-[672px]:p-05">
          <div className="flex flex-wrap items-start justify-between gap-04">
            <h2 id="applied-title" className="text-heading-03">
              Applied at work
            </h2>
            {reflection?.shared ? (
              <Tag color="blue">{reflection.shared}</Tag>
            ) : null}
          </div>
          <dl className="flex flex-col">
            {reflection ? (
              <>
                <Row term="Project">{reflection.project}</Row>
                <Row term="Application">{reflection.application}</Row>
              </>
            ) : null}
            <Row term="Skills shown">
              <ul className="flex flex-wrap gap-03">
                {credential.skills.map((skill) => (
                  <li key={skill}>
                    <Tag>{skill}</Tag>
                  </li>
                ))}
              </ul>
            </Row>
          </dl>
          {reflection ? null : empty}
        </div>
        {reflection ? (
          <p className="bg-interactive px-06 py-05 text-heading-03 font-light text-text-on-color max-[672px]:px-05 max-[672px]:py-04 max-[672px]:text-body-01">
            Applied reflection = I used it.
          </p>
        ) : null}
      </section>
    </div>
  );
}
