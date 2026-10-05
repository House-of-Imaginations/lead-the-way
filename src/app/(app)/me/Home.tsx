"use client";

import { Add, ArrowRight } from "@carbon/icons-react";
import clsx from "clsx";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { CheckIn } from "@/components/app/CheckIn";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  ButtonLink,
  InlineNotification,
  ProgressBar,
  Tag,
  useToast,
} from "@/components/ui";
import { IDEAS } from "@/content/ideas";
import { sessionLine } from "@/content/sessions";
import { userMessage } from "@/lib/errors";

const TEXT_LINK =
  "text-link hover:text-link-hover hover:underline max-[672px]:inline-flex max-[672px]:min-h-[48px] max-[672px]:items-center";

/** Desktop words, and M2's shorter ones below 672px. */
function Twin({ wide, narrow }: { wide: string; narrow: string }) {
  return (
    <>
      <span className="max-[672px]:hidden">{wide}</span>
      <span className="hidden max-[672px]:inline">{narrow}</span>
    </>
  );
}

/** One of 11's three cards: label, title and body on layer-01, its button full width at the foot. */
function Card({
  id,
  label,
  aside,
  title,
  action,
  children,
}: {
  id: string;
  label: string;
  aside?: ReactNode;
  title: string;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col bg-layer-01">
      <div className="flex flex-1 flex-col gap-05 p-05">
        <div className="flex items-center justify-between gap-05">
          <h3 id={id} className="text-label-01 text-text-secondary">
            {label}
          </h3>
          {aside}
        </div>
        <p className="text-heading-03">{title}</p>
        {children}
      </div>
      {action}
    </section>
  );
}

export function Home({
  preloaded,
  greeting,
}: {
  preloaded: Preloaded<typeof api.me.home>;
  greeting: string;
}) {
  const data = usePreloadedQuery(preloaded);
  const expectOrgId = useExpectOrgId();
  const toast = useToast();
  const continueSession = useMutation(api.learning.continueSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No launched sprint yet.
  if (data === null) {
    return (
      <div className="flex max-w-content-max flex-col gap-07">
        <h1 className="text-heading-01">{greeting}</h1>
        <InlineNotification>
          Your week appears here once your manager launches the sprint.
        </InlineNotification>
      </div>
    );
  }

  const session = data.learn.session;
  async function onContinue() {
    setPending(true);
    setError(null);
    try {
      await continueSession({ expectOrgId });
      toast({
        title: "Simulated in this prototype.",
        body: `Session ${session} marked done.`,
      });
    } catch (e) {
      setError(
        userMessage(e, "We couldn't mark the session done. Try again."),
      );
    } finally {
      setPending(false);
    }
  }

  const agreement = data.agreement;
  return (
    <div className="flex max-w-content-max flex-col gap-07">
      <header className="flex items-start justify-between gap-05 max-[672px]:flex-col max-[672px]:gap-03">
        <div className="flex flex-col gap-03">
          <h1 className="text-heading-01">{data.greeting}</h1>
          <p className="text-body-01 text-text-secondary">{data.intro}</p>
        </div>
        <Tag color="blue">{data.protectedTag}</Tag>
      </header>

      {data.agreementUpdated ? (
        <InlineNotification title="Updated.">
          <Link href="/me/agreement" className={TEXT_LINK}>
            Please review and sign.
          </Link>
        </InlineNotification>
      ) : null}

      {data.afterCheckIn ? (
        // Saving turns `afterCheckIn` false, and this query re-renders without it.
        <CheckIn phase="after" expectOrgId={expectOrgId} onDone={() => {}} />
      ) : null}

      <section aria-labelledby="this-week" className="flex flex-col gap-05">
        <h2 id="this-week" className="text-heading-03 max-[672px]:sr-only">
          This week
        </h2>
        <div className="grid grid-cols-3 gap-01 max-[900px]:grid-cols-1 max-[900px]:gap-06">
          <Card
            id="card-learn"
            label="Learn"
            aside={
              <p className="text-label-01 text-text-secondary">
                <Twin wide="15 min session" narrow="15 min" />
              </p>
            }
            title={data.learn.course}
            action={
              <Button
                icon={ArrowRight}
                kind={data.afterCheckIn ? "tertiary" : "primary"}
                className="w-full justify-between"
                disabled={pending}
                onClick={onContinue}
              >
                Continue learning
              </Button>
            }
          >
            <p className="text-body-02 text-text-secondary">
              {sessionLine(session)}
            </p>
            <div className="mt-auto">
              <ProgressBar
                label="Course progress"
                value={data.learn.percent}
                max={100}
              />
            </div>
            {error ? (
              <p role="alert" className="text-label-01 text-support-error">
                {error}
              </p>
            ) : null}
          </Card>

          <Card
            id="card-apply"
            label="Apply"
            title="Use one idea in a real work task"
            action={
              <ButtonLink
                href="/me/project"
                kind="secondary"
                icon={Add}
                className="w-full justify-between"
              >
                Start work project
              </ButtonLink>
            }
          >
            <p className="text-body-02 text-text-secondary max-[672px]:hidden">
              Some ideas that fit this week&apos;s session:
            </p>
            <ul className="flex flex-wrap gap-03 max-[672px]:gap-y-0">
              {IDEAS.map((idea) => (
                <li key={idea.label}>
                  {/* The hit area is 48px on phones; the tag inside keeps its 24px shape. */}
                  <Link
                    href="/me/project"
                    className="group inline-flex items-center max-[672px]:min-h-[48px]"
                  >
                    <span className="ltw-tag group-hover:underline">
                      <Twin wide={idea.label} narrow={idea.short} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            id="card-reflect"
            label="Reflect"
            aside={<Tag color={data.reflect.kind}>{data.reflect.label}</Tag>}
            title="What changed, and how you checked it"
            action={
              <ButtonLink
                href="/me/project#reflect"
                kind="tertiary"
                className="w-full"
              >
                Add reflection
              </ButtonLink>
            }
          >
            <p className="text-body-02 text-text-secondary max-[672px]:hidden">
              A few sentences after you&apos;ve tried it. You decide later
              whether to share it at the show and tell.
            </p>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-2 items-start gap-07 max-[900px]:grid-cols-1">
        <section aria-labelledby="your-sprint" className="flex flex-col gap-05">
          <div className="flex items-baseline justify-between gap-05">
            <h2 id="your-sprint" className="text-heading-03">
              Your sprint
            </h2>
            <Link href="/me/sprint" className={TEXT_LINK}>
              <Twin wide="View sprint" narrow="View" />
            </Link>
          </div>
          <ol aria-labelledby="your-sprint" className="grid grid-cols-4 gap-01">
            {data.weeks.map((week) => {
              const current = week.state === "current";
              return (
                <li
                  key={week.name}
                  aria-current={current ? "step" : undefined}
                  className={clsx(
                    "flex flex-col gap-02 border-t-2 p-05 max-[672px]:p-03",
                    week.state === "todo"
                      ? "border-border-subtle"
                      : "border-interactive",
                    current ? "bg-highlight" : "bg-layer-01",
                  )}
                >
                  <p
                    className={clsx(
                      "text-label-01",
                      current ? "text-support-info" : "text-text-secondary",
                    )}
                  >
                    <Twin wide={week.name} narrow={week.short} />
                  </p>
                  <p className={clsx("text-body-02", current && "font-semibold")}>
                    <Twin wide={week.status} narrow={week.shortStatus} />
                  </p>
                </li>
              );
            })}
          </ol>
          <InlineNotification>
            You are not expected to learn after hours. This session is part of
            your working week.
          </InlineNotification>
        </section>

        {agreement ? (
          <section
            aria-labelledby="my-agreement"
            className="flex flex-col gap-05"
          >
            <div className="flex items-baseline justify-between gap-05">
              <h2 id="my-agreement" className="text-heading-03">
                Team AI Agreement
              </h2>
              <Link href="/me/agreement" className={TEXT_LINK}>
                Read in full
              </Link>
            </div>
            <dl className="border-t border-border-subtle">
              {(
                [
                  ["Tools we use", agreement.tools],
                  ["Never goes in", agreement.neverIn],
                  ["Unsure?", agreement.contact],
                ] as const
              ).map(([term, value]) => (
                <div
                  key={term}
                  className="grid grid-cols-[176px_minmax(0,1fr)] gap-05 border-b border-border-subtle py-05 max-[672px]:grid-cols-1 max-[672px]:gap-02"
                >
                  <dt className="text-body-02 text-text-secondary">{term}</dt>
                  <dd className="text-body-02">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}
