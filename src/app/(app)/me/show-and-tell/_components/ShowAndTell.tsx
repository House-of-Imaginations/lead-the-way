"use client";

import { CheckmarkFilled, PresentationFile } from "@carbon/icons-react";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import { CheckIn } from "@/components/app/CheckIn";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  ButtonLink,
  InlineNotification,
  Modal,
  Tag,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";

type Board = NonNullable<FunctionReturnType<typeof api.showAndTell.board>>;
type Mine = NonNullable<Board["mine"]>;

const PRESENTED = "Presented to your team.";
const NO_BADGE = "Your badge appears when you finish the course.";
const DISCUSS = [
  "What worked?",
  "What failed, and how did you notice?",
  "What should we add to our Team AI Agreement?",
];

/** The viewer's own saved project: hero, three tiles, what they learned, the button row. */
function Project({
  mine,
  hasBadge,
  askBeforeSharing,
}: {
  mine: Mine;
  hasBadge: boolean;
  askBeforeSharing: boolean;
}) {
  const expectOrgId = useExpectOrgId();
  const present = useMutation(api.projects.present);
  const attachReflection = useMutation(api.badges.attachReflection);
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set before the mutation: Convex can deliver the presented board before
  // present() resolves, so the line may mount while it is still pending.
  const presenting = useRef(false);
  const focusDone = useCallback((el: HTMLParagraphElement | null) => {
    if (el && presenting.current) el.focus();
  }, []);

  async function presentProject() {
    setPending(true);
    setError(null);
    presenting.current = true;
    try {
      await present({ expectOrgId });
      toast({ title: PRESENTED });
    } catch (e) {
      presenting.current = false;
      setError(userMessage(e, "Your project wasn't presented. Try again."));
    } finally {
      setConfirming(false);
      setPending(false);
    }
  }

  async function addToBadge() {
    setPending(true);
    setError(null);
    try {
      await attachReflection({ expectOrgId });
      router.push("/me/credential");
    } catch (e) {
      setError(userMessage(e, "Your reflection wasn't added. Try again."));
      setPending(false);
    }
  }

  const tiles = [
    ["Before", mine.before],
    ["What I changed", mine.change],
    ["After", mine.after],
  ] as const;

  return (
    <section aria-labelledby="project-title" className="flex flex-col gap-01">
      <div className="flex items-end justify-between gap-07 bg-text-primary p-06 text-background max-[672px]:flex-col max-[672px]:items-start max-[672px]:p-05">
        <div className="flex min-w-0 flex-1 flex-col gap-03">
          <p className="text-label-01">Your project</p>
          <h2 id="project-title" className="text-heading-02 text-balance">
            {mine.title}
          </h2>
        </div>
        {/* 14 sets "40 min" beside a one-line title: the free-text headline
            stays compact so the title keeps the width. */}
        {mine.headline ? (
          <p className="max-w-[14ch] shrink-0 text-right text-heading-01 max-[672px]:max-w-none max-[672px]:text-left">
            {mine.headline}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-01 max-[672px]:grid-cols-1">
        {tiles.map(([term, text]) => (
          <div key={term} className="flex flex-col gap-03 bg-layer-01 p-05">
            <dt className="text-label-01 text-text-secondary">{term}</dt>
            <dd className="text-body-01">{text}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-05 bg-layer-01 p-06 max-[672px]:p-05">
        {mine.learned !== null ? (
          <figure className="flex flex-col gap-03">
            <figcaption className="text-label-01 text-text-secondary">
              What I learned
            </figcaption>
            <blockquote className="text-heading-03 font-light">
              &ldquo;{mine.learned}&rdquo;
            </blockquote>
          </figure>
        ) : null}
        <ul aria-label="Checks" className="flex flex-wrap gap-03">
          {mine.humanReviewed ? (
            <li>
              <Tag color="green">Output reviewed</Tag>
            </li>
          ) : null}
          {mine.dataSafe ? (
            <li>
              <Tag color="green">No restricted data</Tag>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="grid grid-cols-3 max-[672px]:grid-cols-1">
        <ButtonLink href="/me/project#reflect" kind="ghost" className="w-full">
          Edit reflection
        </ButtonLink>
        {mine.onBadge ? (
          <ButtonLink href="/me/credential" kind="tertiary" className="w-full">
            View credential
          </ButtonLink>
        ) : (
          <Button
            kind="tertiary"
            className="w-full"
            disabled={!hasBadge || pending}
            aria-describedby={hasBadge ? undefined : "no-badge"}
            onClick={addToBadge}
          >
            Add to badge
          </Button>
        )}
        {mine.presented ? (
          <p
            ref={focusDone}
            tabIndex={-1}
            className="flex min-h-control-lg items-center gap-03 px-05 text-body-02"
          >
            <CheckmarkFilled
              size={16}
              aria-hidden="true"
              className="shrink-0 text-support-success"
            />
            You presented this project.
          </p>
        ) : askBeforeSharing ? (
          <Modal
            label="Show and tell"
            title="Present to your team?"
            description="Your project title, before, change, after and headline become visible to your team and your manager. Your course activity stays private."
            open={confirming}
            onOpenChange={setConfirming}
            // The trigger is gone once presented; focus stays on the line instead.
            onCloseAutoFocus={(e) => {
              if (presenting.current) e.preventDefault();
            }}
            trigger={
              <Button
                icon={PresentationFile}
                className="w-full"
                disabled={pending}
              >
                Present to team
              </Button>
            }
            primaryText="Present project"
            onPrimary={presentProject}
            primaryDisabled={pending}
          />
        ) : (
          <Button
            icon={PresentationFile}
            className="w-full"
            disabled={pending}
            onClick={presentProject}
          >
            Present to team
          </Button>
        )}
      </div>
      {hasBadge ? null : (
        <p id="no-badge" className="pt-03 text-label-01 text-text-secondary">
          {NO_BADGE}
        </p>
      )}
      {error ? (
        <p role="alert" className="pt-03 text-label-01 text-support-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** Presented projects, oldest first: a title and a first name, nothing else (Ruling 14). */
function Session({ presented }: { presented: Board["presented"] }) {
  return (
    <section aria-labelledby="session-title" className="flex flex-col gap-04">
      <h2
        id="session-title"
        className="border-b border-border-inverse pb-04 text-heading-03"
      >
        In this session
      </h2>
      {presented.length > 0 ? (
        <ol aria-labelledby="session-title" className="-mt-04">
          {presented.map((p, i) => (
            <li
              // ponytail: a static ordered list; index keys never reorder.
              key={i}
              className="flex justify-between gap-05 border-b border-border-subtle py-04 text-body-02"
            >
              <span>{p.title}</span>
              <span className="shrink-0 text-text-secondary">
                {p.firstName}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-body-02 text-text-secondary">
          No one has presented yet.
        </p>
      )}
      <p className="text-label-01 text-text-secondary">
        Everyone chose to share. Nothing is shared automatically.
      </p>
    </section>
  );
}

export function ShowAndTell({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.showAndTell.board>;
}) {
  const board = usePreloadedQuery(preloaded);
  const expectOrgId = useExpectOrgId();
  return (
    <div className="flex flex-col gap-07">
      <header className="flex flex-col gap-03">
        <div className="flex flex-wrap items-center gap-04">
          <h1 className="text-heading-01">Team AI show and tell</h1>
          {board?.weekTag ? <Tag color="blue">{board.weekTag}</Tag> : null}
        </div>
        <p className="text-body-01 text-text-secondary">
          Share what changed, not just what you completed.
        </p>
      </header>

      {board === null ? (
        <InlineNotification>
          The show and tell opens once your team&apos;s sprint starts.
        </InlineNotification>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-09 max-[900px]:grid-cols-1">
          <div className="flex min-w-0 flex-col gap-07">
            {board.afterCheckIn ? (
              // Answering turns afterCheckIn false, so the card goes by itself.
              <CheckIn
                phase="after"
                expectOrgId={expectOrgId}
                onDone={() => {}}
              />
            ) : null}
            {board.mine ? (
              <Project
                mine={board.mine}
                hasBadge={board.hasBadge}
                askBeforeSharing={board.askBeforeSharing}
              />
            ) : (
              <div className="flex flex-col items-start gap-05">
                <InlineNotification title="Save your work project first.">
                  It appears here once you save it, and only you see it until
                  you present it.
                </InlineNotification>
                <ButtonLink href="/me/project" kind="tertiary">
                  Open work project
                </ButtonLink>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-07">
            <Session presented={board.presented} />
            <section
              aria-labelledby="discuss-title"
              className="flex flex-col gap-04 bg-layer-01 p-05"
            >
              <h2 id="discuss-title" className="text-heading-04">
                Discuss as a team
              </h2>
              <ul className="flex list-[square] flex-col gap-02 pl-05 text-body-02">
                {DISCUSS.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
