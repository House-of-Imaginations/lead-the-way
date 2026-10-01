"use client";

import {
  ArrowRight,
  Checkmark,
  CheckmarkFilled,
  RadioButton,
  RadioButtonChecked,
} from "@carbon/icons-react";
import clsx from "clsx";
import { useQuery } from "convex-helpers/react/cache";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { ModuleKey } from "@convex/lib/pathway";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  InlineNotification,
  LikertScale,
  Modal,
  ProgressBar,
  Tag,
  VideoPlayer,
} from "@/components/ui";
import { PATHWAY_CONTENT } from "@/content/pathway";
import { userMessage } from "@/lib/errors";
import { vttText } from "@/lib/vtt";

type Pathway = FunctionReturnType<typeof api.pathway.forViewer>;
type Module = Pathway["modules"][number];

const SAVE_FAILED = "That didn't save. Try again.";

function ModuleRow({
  module,
  selected,
  onSelect,
}: {
  module: Module;
  selected: boolean;
  onSelect: () => void;
}) {
  const { title, objective } = PATHWAY_CONTENT[module.key];
  // State comes from progress; selection shows only as the rule, the fill and aria-current.
  const inProgress = module.unlocked && !module.done;
  const Icon = module.done
    ? CheckmarkFilled
    : inProgress
      ? RadioButtonChecked
      : RadioButton;
  return (
    <li className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={clsx(
          "grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-04 border-l-[3px] p-05 text-left transition-colors duration-[70ms] ease-productive",
          selected
            ? "border-l-interactive bg-layer-selected"
            : "border-l-transparent hover:bg-layer-hover",
        )}
      >
        <Icon
          size={20}
          aria-hidden="true"
          className={
            module.done
              ? "text-support-success"
              : inProgress
                ? "text-interactive"
                : "text-text-secondary"
          }
        />
        <span className="flex flex-col items-start gap-02">
          <span className="text-body-emphasis">{title}</span>
          <span className="text-body-02 text-text-secondary">{objective}</span>
          <span className="pt-03">
            {module.done ? (
              <Tag color="green">Completed</Tag>
            ) : inProgress ? (
              <Tag color="blue">In progress</Tag>
            ) : (
              <Tag>Not started</Tag>
            )}
          </span>
        </span>
        <span className="text-label-01 text-text-secondary tabular-nums">
          {module.minutes} min
        </span>
      </button>
    </li>
  );
}

export function PathwayView({ initial }: { initial: Pathway }) {
  const data = useQuery(api.pathway.forViewer, {}) ?? initial;
  const expectOrgId = useExpectOrgId();
  const router = useRouter();
  const completeModule = useMutation(api.pathway.completeModule);
  const rateConfidence = useMutation(api.pathway.rateConfidence);

  const [selectedKey, setSelectedKey] = useState<ModuleKey>(
    () => (initial.modules.find((m) => !m.done) ?? initial.modules[0]).key,
  );
  const [score, setScore] = useState<number | null>(initial.afterConfidence);
  const [pending, setPending] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  // null while loading, "failed" when the captions file didn't come back.
  const [transcript, setTranscript] = useState<string[] | "failed" | null>(
    null,
  );

  const required = data.modules.filter((m) => m.pathway === "required");
  const coaching = data.modules.filter((m) => m.pathway === "coaching");
  const current =
    data.modules.find((m) => m.key === selectedKey) ?? data.modules[0];
  const path = current.pathway === "required" ? required : coaching;
  const content = PATHWAY_CONTENT[current.key];
  const ready = data.required.done === data.required.total;
  const reason = current.done
    ? "You've completed this module."
    : current.unlocked
      ? null
      : "Finish the earlier modules first.";

  function select(key: ModuleKey) {
    setSelectedKey(key);
    // Stacked (the grid's max-[900px]), the player sits under the lists, so
    // bring it up or the tap shows nothing.
    if (window.matchMedia("(width < 900px)").matches)
      document.getElementById("module-player")?.scrollIntoView();
  }

  async function markComplete() {
    setPending(true);
    setCompleteError(null);
    try {
      await completeModule({ expectOrgId, moduleKey: current.key });
      const next = path.find((m) => !m.done && m.key !== current.key);
      if (next) setSelectedKey(next.key);
    } catch (error) {
      setCompleteError(userMessage(error, SAVE_FAILED));
    } finally {
      setPending(false);
    }
  }

  // P5 Ruling 16: once the sprint has launched, the panel leads to the overview.
  const next = data.launched
    ? { label: "Go to overview", href: "/manager" }
    : { label: "Continue to agreement", href: "/manager/agreement" };

  async function continueOn() {
    setPending(true);
    setRateError(null);
    try {
      // No score is a skip, and a skip is recorded by writing nothing (Ruling 4).
      if (score !== null) await rateConfidence({ expectOrgId, score });
      router.push(next.href);
    } catch (error) {
      setRateError(userMessage(error, SAVE_FAILED));
      setPending(false);
    }
  }

  function onTranscript(open: boolean) {
    setTranscriptOpen(open);
    if (!open) return;
    setTranscript(null);
    void fetch(content.captions)
      .then((res) =>
        res.ok ? res.text() : Promise.reject(new Error(String(res.status))),
      )
      .then((vtt) => setTranscript(vttText(vtt)))
      .catch(() => setTranscript("failed"));
  }

  return (
    <div className="flex max-w-content-max flex-col gap-07">
      <header className="flex items-end justify-between gap-07 max-[900px]:flex-col max-[900px]:items-stretch">
        <div className="flex max-w-[640px] flex-col gap-03">
          <nav aria-label="Breadcrumb" className="text-body-02">
            <Link
              href="/manager/learning"
              className="text-link hover:text-link-hover hover:underline"
            >
              My learning
            </Link>
            <span aria-hidden="true" className="pl-03 text-text-secondary">
              /
            </span>
          </nav>
          <h1 id="pathway-title" className="text-heading-01">
            Leading AI at Work
          </h1>
          <p className="text-body-01 text-text-secondary">
            Three short modules that prepare you to lead your team&apos;s
            sprint. Built from existing SkillsBuild courses, about 25 minutes in
            total.
          </p>
        </div>
        <div className="w-[280px] shrink-0 max-[900px]:w-full">
          <ProgressBar
            label="Progress"
            value={data.required.done}
            max={data.required.total}
            valueText={`${data.required.done} of ${data.required.total} complete`}
          />
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start gap-07 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-07">
          <ul aria-labelledby="pathway-title" className="bg-layer-01">
            {required.map((m) => (
              <ModuleRow
                key={m.key}
                module={m}
                selected={m.key === current.key}
                onSelect={() => select(m.key)}
              />
            ))}
          </ul>
          <section
            aria-labelledby="coaching-title"
            className="flex flex-col gap-03"
          >
            <div className="flex items-baseline justify-between gap-05">
              <h2 id="coaching-title" className="text-heading-03">
                Leading AI in Your Team
              </h2>
              <span className="text-label-01 text-text-secondary tabular-nums">
                {data.coachingPercent}% complete
              </span>
            </div>
            <ul aria-labelledby="coaching-title" className="bg-layer-01">
              {coaching.map((m) => (
                <ModuleRow
                  key={m.key}
                  module={m}
                  selected={m.key === current.key}
                  onSelect={() => select(m.key)}
                />
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-05">
          {ready ? (
            <section
              aria-labelledby="ready-title"
              className="flex flex-col gap-05 border-b border-border-subtle pb-07"
            >
              <h2 id="ready-title" className="text-heading-02">
                Ready to launch?
              </h2>
              <InlineNotification kind="success">
                You&apos;ve finished the manager pathway.
              </InlineNotification>
              <LikertScale
                name="after-confidence"
                legend="How confident do you feel setting shared AI norms with your team?"
                value={score}
                onChange={setScore}
                minLabel="Not at all"
                maxLabel="Very"
              />
              <Button
                icon={ArrowRight}
                disabled={pending}
                onClick={continueOn}
                className="self-start"
              >
                {next.label}
              </Button>
              {rateError ? (
                <p role="alert" className="text-label-01 text-support-error">
                  {rateError}
                </p>
              ) : null}
            </section>
          ) : null}

          <div id="module-player" className="scroll-mt-05">
            <VideoPlayer
              key={current.key}
              src={content.video}
              captions={content.captions}
              label={content.title}
            />
          </div>
          <div className="flex flex-col gap-03 bg-layer-01 p-05">
            <p className="text-label-01 text-text-secondary">
              {current.pathway === "required" ? "Module" : "Coaching module"}{" "}
              {path.findIndex((m) => m.key === current.key) + 1} of{" "}
              {path.length}
            </p>
            <h2 className="text-heading-03">{content.title}</h2>
            <p className="text-body-02">{content.idea}</p>
            <p className="text-label-01 text-text-secondary">
              Placeholder video and captions. The final video is on its way.
            </p>
          </div>
          <div className="grid grid-cols-2 max-[672px]:grid-cols-1">
            <Modal
              title="Transcript"
              label={content.title}
              trigger={
                <Button kind="tertiary" className="w-full">
                  Open transcript
                </Button>
              }
              open={transcriptOpen}
              onOpenChange={onTranscript}
            >
              <div className="flex flex-col gap-03">
                {transcript === null ? (
                  <p>Loading the transcript.</p>
                ) : transcript === "failed" ? (
                  <p role="alert">
                    The transcript couldn&apos;t load. Close this and try again.
                  </p>
                ) : (
                  transcript.map((line, i) => <p key={i}>{line}</p>)
                )}
              </div>
            </Modal>
            <Button
              kind={ready ? "secondary" : "primary"}
              icon={Checkmark}
              className="w-full"
              disabled={reason !== null || pending}
              aria-describedby={reason ? "complete-reason" : undefined}
              onClick={markComplete}
            >
              Mark as complete
            </Button>
          </div>
          {reason ? (
            <p
              id="complete-reason"
              className="text-label-01 text-text-secondary"
            >
              {reason}
            </p>
          ) : null}
          {completeError ? (
            <p role="alert" className="text-label-01 text-support-error">
              {completeError}
            </p>
          ) : null}
          <p className="text-label-01 text-text-secondary">
            The full 60-minute Leading AI in Your Team path stays open during
            the sprint.
          </p>
        </div>
      </div>
    </div>
  );
}
