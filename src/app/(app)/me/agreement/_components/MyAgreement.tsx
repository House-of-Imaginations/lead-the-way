"use client";

import { Edit } from "@carbon/icons-react";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Avatar,
  Button,
  InlineNotification,
  Tag,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-07 border-b border-border-subtle py-05 max-[900px]:grid-cols-1 max-[900px]:gap-03">
      <dt className="text-heading-04">{title}</dt>
      <dd className="flex flex-col gap-02 text-body-02">{children}</dd>
    </div>
  );
}

export function MyAgreement({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.agreements.forMe>;
}) {
  const a = usePreloadedQuery(preloaded);
  const sign = useMutation(api.agreements.sign);
  const expectOrgId = useExpectOrgId();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSign(version: number) {
    setPending(true);
    setError(null);
    try {
      await sign({ version, expectOrgId });
      toast({ title: "Agreement signed" });
    } catch (e) {
      setError(userMessage(e, "The agreement didn't sign. Try again."));
    } finally {
      setPending(false);
    }
  }

  if (!a) {
    return (
      <div className="flex max-w-content-max flex-col gap-05">
        <h1 className="text-heading-01">Our Team AI Agreement</h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          {"Your team's agreement isn't ready yet. It appears here once your manager saves it."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid max-w-content-max grid-cols-[minmax(0,1fr)_320px] items-start gap-09 max-[900px]:grid-cols-1 max-[900px]:gap-07">
      <article aria-labelledby="agreement-title" className="flex flex-col gap-06">
        <header className="flex flex-col gap-02">
          <p className="text-label-01 text-text-secondary">{a.heading}</p>
          <h1 id="agreement-title" className="text-heading-01">
            Our Team AI Agreement
          </h1>
        </header>
        {a.mine === "updated" && (
          <InlineNotification title="Updated.">
            Please review and sign.
          </InlineNotification>
        )}
        <dl className="border-t border-border-subtle">
          <Row title="Tools we use">
            <p>{a.tools}</p>
          </Row>
          <Row title="What never goes in">
            {a.neverIn.length > 0 && <p>{`${a.neverIn.join(", ")}.`}</p>}
            {a.practise && <p className="text-text-secondary">{a.practise}</p>}
          </Row>
          <Row title="How we check outputs">
            <ul className="list-disc pl-05">
              {a.checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Row>
          <Row title="When and who to ask">
            <p className="whitespace-pre-line">{a.escalation}</p>
            <p>{a.contact}</p>
          </Row>
        </dl>
        <blockquote className="bg-highlight p-06 text-heading-03 font-light">
          Using AI here is normal. Tell us what works, what fails and what you
          learn.
        </blockquote>
      </article>

      <aside aria-labelledby="signatures-title" className="flex flex-col bg-layer-01">
        <div className="flex flex-col gap-04 p-05">
          <div className="flex items-center justify-between gap-03">
            <h2 id="signatures-title" className="text-heading-03">
              Signatures
            </h2>
            {a.signatures && (
              <Tag>{`${a.signatures.signed} of ${a.signatures.of}`}</Tag>
            )}
          </div>
          {a.mine === "signed" && (
            <p className="flex items-center gap-03">
              <Avatar initials={a.initials} manager={false} />
              <Tag color="green">Signed</Tag>
            </p>
          )}
          <p className="text-body-02 text-text-secondary">
            {"Signing means you've read it and will follow it. You can raise changes at the week 4 review."}
          </p>
        </div>
        {a.mine !== "signed" && (
          <Button
            icon={Edit}
            className="w-full"
            disabled={pending}
            onClick={() => void onSign(a.version)}
          >
            Sign the agreement
          </Button>
        )}
        {error && (
          <p role="alert" className="p-05 text-label-01 text-support-error">
            {error}
          </p>
        )}
      </aside>
    </div>
  );
}
