"use client";

import { ArrowRight, Video } from "@carbon/icons-react";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import {
  Avatar,
  Button,
  ButtonLink,
  InlineNotification,
  Tag,
  TextArea,
  Toggle,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { atLabel } from "@/lib/careers/when";

const MAX_REFLECTION = 2000;
const SAVE_AFTER_MS = 800;

export function DemoDay({
  session: preloaded,
  step,
}: {
  session: Preloaded<typeof api.careers.demoDay.session>;
  /** "Credential 1 of 3, week 3". */
  step: string;
}) {
  const session = usePreloadedQuery(preloaded);
  const saveReflection = useMutation(api.careers.demoDay.saveReflection);
  const setAddToProof = useMutation(api.careers.demoDay.setAddToProof);
  const present = useMutation(api.careers.demoDay.present);
  const toast = useToast();
  const mine = session?.mine ?? null;
  const [reflection, setReflection] = useState(mine?.reflection ?? "");
  const [toProof, setToProof] = useState(mine?.addReflectionToProof ?? false);
  const [presented, setPresented] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Autosaved as the learner types, once they pause.
  function onReflection(text: string) {
    setReflection(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveReflection({ reflection: text }).catch((e: unknown) =>
        setError(userMessage(e, "Your reflection wasn't saved. Try again.")),
      );
    }, SAVE_AFTER_MS);
  }

  async function onProof(on: boolean) {
    setToProof(on);
    try {
      await setAddToProof({ on });
    } catch (e) {
      setToProof(!on);
      setError(userMessage(e, "That change wasn't saved. Try again."));
    }
  }

  async function onPresent() {
    setPending(true);
    setError(null);
    try {
      await present({});
      toast({
        title: "Presented to your crew.",
        body: "They see your task, never a score.",
      });
      setPresented(true);
    } catch (e) {
      setError(userMessage(e, "That didn't reach your crew. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <main className="flex flex-1 flex-col gap-06 px-05 pt-06 pb-07 lg:max-w-[720px] lg:px-07 lg:py-07">
        <div className="flex flex-col gap-03">
          <span className="self-start">
            <Tag color="blue">{step}</Tag>
          </span>
          <h1 className="text-heading-01 text-balance">Crew demo day</h1>
          <p className="text-body-01 text-text-secondary">
            Show what you made and what you learned, not just what you finished.
          </p>
        </div>

        {!session ? (
          <InlineNotification title="No demo day yet.">
            Your guide sets one near the end of the credential.
          </InlineNotification>
        ) : (
          <>
            <div className="flex items-center justify-between gap-05 bg-layer-01 p-05">
              <div className="flex flex-col gap-01">
                <p className="text-heading-04">{atLabel(session.at)}</p>
                <p className="text-label-01 text-text-secondary">
                  Video call, 5 minutes each
                </p>
              </div>
              <Video className="ltw-i" aria-hidden="true" />
            </div>

            <section
              aria-labelledby="your-project"
              className="flex flex-col gap-04 [&_.ltw-trow]:border-0"
            >
              <div className="flex items-center justify-between gap-05">
                <h2 id="your-project" className="text-heading-04">
                  Your project
                </h2>
                {mine?.reviewedBy && (
                  <Tag color="green">{`Reviewed by ${mine.reviewedBy}`}</Tag>
                )}
              </div>
              {mine ? (
                <>
                  <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-05 gap-y-03 text-body-02">
                    <dt className="text-text-secondary">The task</dt>
                    <dd>{mine.task}</dd>
                    <dt className="text-text-secondary">What I did</dt>
                    <dd>{mine.whatIDid || "Not written yet."}</dd>
                  </dl>
                  <TextArea
                    id="reflection"
                    label="What I learned"
                    helper="Your reflection, in your words. Edit it any time."
                    rows={4}
                    maxLength={MAX_REFLECTION}
                    value={reflection}
                    onChange={(e) => onReflection(e.target.value)}
                  />
                  <Toggle
                    id="to-proof"
                    label="Add this reflection to my proof"
                    description="Shown only on links you share"
                    checked={toProof}
                    onChange={(on) => void onProof(on)}
                  />
                </>
              ) : (
                <p className="text-body-02 text-text-secondary">
                  Your project shows here once you start it.
                </p>
              )}
            </section>

            <section
              aria-labelledby="in-session"
              className="flex flex-col gap-03"
            >
              <h2 id="in-session" className="text-heading-04">
                In this session
              </h2>
              <ul className="flex flex-col">
                {session.presenting.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-04 border-b border-border-subtle py-03"
                  >
                    <Avatar
                      initials={p.initials}
                      kind={p.you ? "org" : "person"}
                      manager={false}
                    />
                    <span className="flex-1">{p.task}</span>
                    <span className="text-label-01 text-text-secondary">
                      {p.you ? "You" : p.firstName}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-label-01 text-text-secondary">
                Everyone chose to share. Nothing is shared automatically.
              </p>
            </section>

            <section
              aria-labelledby="talk"
              className="flex flex-col gap-02 bg-layer-01 p-05"
            >
              <h2 id="talk" className="text-heading-04">
                Talk about as a crew
              </h2>
              <p className="text-body-02 text-text-secondary">
                What worked? What went wrong, and how did you notice? What
                should we add to our Crew Agreement?
              </p>
            </section>
          </>
        )}
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </main>
      {mine && (
        <div className="ltw-cf lg:static lg:max-w-[720px] lg:border-0 lg:px-07 lg:pt-0">
          {presented ? (
            <ButtonLink
              href="/careers/proof"
              icon={ArrowRight}
              className="w-full lg:w-auto"
            >
              See your credential
            </ButtonLink>
          ) : (
            <Button
              icon={Video}
              className="w-full lg:w-auto"
              disabled={pending}
              onClick={() => void onPresent()}
            >
              Present to my crew
            </Button>
          )}
        </div>
      )}
    </>
  );
}
