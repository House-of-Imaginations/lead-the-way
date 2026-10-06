"use client";

import { Checkmark, Close } from "@carbon/icons-react";
import clsx from "clsx";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  PROJECT_LIMITS,
  RESULT_TYPES,
  SCREENSHOT_TYPES,
  screenshotProblem,
} from "@convex/lib/projectLimits";
import type { MyProject, ProjectFields } from "@convex/projects";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  ButtonLink,
  Checkbox,
  FileDrop,
  InlineNotification,
  TextArea,
  TextInput,
  useToast,
} from "@/components/ui";
import { BEFORE_YOU_START, DANS_EXAMPLE } from "@/content/project";
import { SESSIONS } from "@/content/sessions";
import { userMessage } from "@/lib/errors";
import { useTimedQuery } from "@/lib/useTimedQuery";

const EMPTY: ProjectFields = {
  title: "",
  before: "",
  change: "",
  after: "",
  resultTypes: [],
  headline: "",
  humanReviewed: false,
  dataSafe: false,
};

function fieldsOf(project: MyProject["project"]): ProjectFields {
  if (!project) return EMPTY;
  const { title, before, change, after, resultTypes, headline } = project;
  const { humanReviewed, dataSafe } = project;
  return {
    title,
    before,
    change,
    after,
    resultTypes,
    headline,
    humanReviewed,
    dataSafe,
  };
}

/** One form row: title and helper on the left, fields on the right (12). On phones the left goes to screen readers only, as M3 has it. */
function Section({
  id,
  title,
  helper,
  onPhone = false,
  children,
}: {
  id: string;
  title: string;
  helper: string;
  onPhone?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={clsx(
        "grid grid-cols-[200px_minmax(0,1fr)] gap-07 border-t border-border-subtle py-06 max-[900px]:grid-cols-1 max-[900px]:gap-05",
        // M3 stacks the fields without rules; only a titled section keeps its hairline.
        !onPhone && "max-[672px]:border-t-0 max-[672px]:pt-0",
      )}
    >
      <div
        className={clsx(
          "flex flex-col gap-02",
          !onPhone && "max-[672px]:sr-only",
        )}
      >
        <h2 id={`${id}-title`} className="text-heading-04">
          {title}
        </h2>
        <p className="text-body-02 text-text-secondary">{helper}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-05">{children}</div>
    </section>
  );
}

export function ProjectForm({ initial }: { initial: MyProject }) {
  // `initial` is never null, so neither is the kept answer.
  const data = useTimedQuery(api.projects.mine, initial) ?? initial;
  const expectOrgId = useExpectOrgId();
  const saveDraft = useMutation(api.projects.saveDraft);
  const save = useMutation(api.projects.save);
  const saveReflection = useMutation(api.projects.saveReflection);
  const generateUploadUrl = useMutation(api.projects.generateUploadUrl);
  const setScreenshot = useMutation(api.projects.setScreenshot);
  const toast = useToast();

  const [form, setForm] = useState(() => fieldsOf(initial.project));
  const [reflection, setReflection] = useState(() => ({
    learned: initial.project?.learned ?? "",
    howChecked: initial.project?.howChecked ?? "",
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The fields not yet saved, kept until a save succeeds, so leaving the page (or a failed save) still has them.
  const unsaved = useRef<ProjectFields | null>(null);
  // The latest form, for handlers whose closure is older than the typing done while they waited.
  const latest = useRef(form);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const fields = unsaved.current;
      // ponytail: nowhere left to show an error once the page is gone.
      if (fields) saveDraft({ expectOrgId, ...fields }).catch(() => {});
    },
    [saveDraft, expectOrgId],
  );

  const project = data.project;
  const saved = project?.status === "saved";
  const checked = form.humanReviewed && form.dataSafe;
  // `week` is 1 to the sprint's last (projects.mine); a longer sprint keeps the last tip.
  const tip = SESSIONS[Math.min(data.week, SESSIONS.length) - 1]!;

  function autosave(next: ProjectFields) {
    unsaved.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDraft({ expectOrgId, ...next }).then(
        () => {
          // Newer typing stays pending for its own timer.
          if (unsaved.current === next) unsaved.current = null;
          setError(null);
        },
        (e: unknown) =>
          setError(
            userMessage(
              e,
              "Your draft didn't save. It tries again when you type.",
            ),
          ),
      );
    }, 1000);
  }

  function change(patch: Partial<ProjectFields>) {
    const next = { ...form, ...patch };
    setForm(next);
    latest.current = next;
    // Ruling 12: autosave while a draft; once saved, only "Save project" writes.
    if (!saved) autosave(next);
  }

  const toggleType = (type: string, on: boolean) =>
    change({
      resultTypes: on
        ? [...form.resultTypes, type]
        : form.resultTypes.filter((t) => t !== type),
    });

  async function saveProject() {
    // A pending autosave would only be a no-op after this (saveDraft leaves a saved project alone).
    clearTimeout(timer.current);
    // `unsaved` stays set until the save lands, so leaving mid-save still flushes the draft.
    const attempted = form;
    setPending(true);
    setError(null);
    try {
      await save({ expectOrgId, ...attempted });
      if (unsaved.current === attempted) unsaved.current = null;
      toast({
        title: "Project saved",
        body: "Add a reflection below when you're ready.",
      });
    } catch (e) {
      setError(userMessage(e, "Your project didn't save. Try again."));
      // Still a draft, so the latest edits (including any typed while saving) go back on the timer.
      if (!saved) autosave(latest.current);
    } finally {
      setPending(false);
    }
  }

  async function saveReflectionNow() {
    setReflecting(true);
    setReflectError(null);
    try {
      await saveReflection({ expectOrgId, ...reflection });
      toast({ title: "Reflection saved" });
    } catch (e) {
      setReflectError(
        userMessage(e, "Your reflection didn't save. Try again."),
      );
    } finally {
      setReflecting(false);
    }
  }

  async function upload(file: File) {
    const problem = screenshotProblem(file.type, file.size);
    if (problem) {
      setFileError(problem.message);
      return;
    }
    setFileError(null);
    setUploading(true);
    try {
      // A screenshot hangs on the project row, so make the draft first.
      if (!project) await saveDraft({ expectOrgId, ...form });
      const url = await generateUploadUrl({ expectOrgId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as {
        storageId: Id<"_storage">;
      };
      await setScreenshot({ expectOrgId, storageId });
    } catch (e) {
      setFileError(userMessage(e, "The screenshot didn't upload. Try again."));
    } finally {
      setUploading(false);
    }
  }

  async function removeScreenshot() {
    setRemoving(true);
    setFileError(null);
    try {
      await setScreenshot({ expectOrgId, storageId: null });
    } catch (e) {
      setFileError(userMessage(e, "The screenshot wasn't removed. Try again."));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-09 max-[900px]:grid-cols-1 max-[900px]:gap-07">
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-x-07 gap-y-03 pb-06">
          <div className="flex max-w-[560px] flex-col gap-03">
            <h1 className="text-heading-01">Apply it to your work</h1>
            <p className="text-body-01 text-text-secondary">
              Choose one real task where this week&apos;s learning could create
              a useful improvement.
            </p>
          </div>
          <button
            type="button"
            className="text-body-02 text-link hover:text-link-hover hover:underline max-[672px]:min-h-control-lg"
            onClick={() => change(DANS_EXAMPLE)}
          >
            Use Dan&apos;s example
          </button>
        </header>

        <div className="flex flex-col [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
          <Section
            id="task"
            title="The task"
            helper="Something you already do most weeks."
          >
            <TextInput
              id="title"
              label="Project title"
              placeholder="For example, AI-assisted weekly client reporting"
              maxLength={PROJECT_LIMITS.title}
              value={form.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </Section>

          <Section
            id="story"
            title="Before, change, after"
            helper="Plain words. Rough numbers are fine."
          >
            <TextArea
              id="before"
              label="How did you complete this task before?"
              placeholder="Preparing the weekly client report usually took around two hours and required manually structuring the first draft."
              maxLength={PROJECT_LIMITS.text}
              value={form.before}
              onChange={(e) => change({ before: e.target.value })}
            />
            <TextArea
              id="change"
              label="What did you apply from the learning?"
              placeholder="I created a reusable AI prompt to structure the first draft, then checked all client metrics manually."
              maxLength={PROJECT_LIMITS.text}
              value={form.change}
              onChange={(e) => change({ change: e.target.value })}
            />
            <TextArea
              id="after"
              label="What changed?"
              rows={2}
              placeholder="The process now takes about 1 hour 20 minutes."
              maxLength={PROJECT_LIMITS.text}
              value={form.after}
              onChange={(e) => change({ after: e.target.value })}
            />
          </Section>

          <Section id="result" title="Result" helper="Pick any that apply.">
            <fieldset className="flex flex-col gap-03">
              <legend className="ltw-lbl pb-03">Type of improvement</legend>
              <div className="grid grid-cols-2 gap-x-06 gap-y-03 max-[672px]:grid-cols-1">
                {RESULT_TYPES.map((type) => (
                  <Checkbox
                    key={type}
                    label={type}
                    checked={form.resultTypes.includes(type)}
                    onChange={(e) => toggleType(type, e.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
            <div className="max-w-[360px] max-[672px]:max-w-none">
              <TextInput
                id="headline"
                label="Headline result"
                placeholder="For example, 40 minutes saved per week"
                maxLength={PROJECT_LIMITS.headline}
                value={form.headline}
                onChange={(e) => change({ headline: e.target.value })}
              />
            </div>
          </Section>

          <Section
            id="checks"
            title="Checks"
            helper="Both are required to save."
            onPhone
          >
            <Checkbox
              label="I reviewed the output before using it in work."
              checked={form.humanReviewed}
              onChange={(e) => change({ humanReviewed: e.target.checked })}
            />
            <Checkbox
              label="I did not include restricted client or personal information."
              checked={form.dataSafe}
              onChange={(e) => change({ dataSafe: e.target.checked })}
            />
            <div className="min-[672px]:hidden">
              <InlineNotification>
                Use approved tools and de-identified data. Don&apos;t upload
                confidential work files.
              </InlineNotification>
            </div>
          </Section>

          <Section
            id="screenshot"
            title="Supporting screenshot"
            helper="Optional. De-identified only."
          >
            <FileDrop
              id="screenshot-file"
              label="Drag a file here or click to upload"
              helper="PNG or JPG, up to 5 MB."
              accept={SCREENSHOT_TYPES}
              onFile={upload}
              error={fileError}
              // Each branch is busy only with its own action, so the swap after either never flashes the other's words.
              busy={project?.screenshotUrl ? removing : uploading}
              current={
                project?.screenshotUrl
                  ? {
                      url: project.screenshotUrl,
                      alt: "Your supporting screenshot",
                    }
                  : null
              }
              onRemove={removeScreenshot}
            />
          </Section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-05 gap-y-03 border-t border-border-subtle pt-06">
          {project ? (
            <p className="mr-auto text-label-01 text-text-secondary">
              {project.autosavedLabel}
            </p>
          ) : null}
          {!checked ? (
            <p id="save-reason" className="text-label-01 text-text-secondary">
              Tick both checks to save.
            </p>
          ) : null}
          <div className="flex max-[672px]:w-full">
            <ButtonLink
              href="/me"
              kind="secondary"
              className="w-[200px] max-[672px]:hidden"
            >
              Cancel
            </ButtonLink>
            <Button
              className="w-[200px] max-[672px]:w-full"
              disabled={!checked || pending}
              aria-describedby={checked ? undefined : "save-reason"}
              onClick={saveProject}
            >
              Save project
            </Button>
          </div>
          {error ? (
            <p
              role="alert"
              className="w-full text-right text-label-01 text-support-error"
            >
              {error}
            </p>
          ) : null}
        </div>

        {/* Always here, so 11's "Add reflection" link lands on it before a save too. */}
        <div className="pt-07">
          <Section
            id="reflect"
            title="Reflect"
            helper="What you learned, for the show and tell and your credential."
            onPhone
          >
            {saved ? (
              <>
                <TextArea
                  id="learned"
                  label="What I learned"
                  maxLength={PROJECT_LIMITS.text}
                  value={reflection.learned}
                  onChange={(e) =>
                    setReflection((r) => ({ ...r, learned: e.target.value }))
                  }
                />
                <TextArea
                  id="how-checked"
                  label="How you checked it"
                  maxLength={PROJECT_LIMITS.text}
                  value={reflection.howChecked}
                  onChange={(e) =>
                    setReflection((r) => ({ ...r, howChecked: e.target.value }))
                  }
                />
                <div className="flex flex-col items-start gap-02">
                  <Button
                    kind="tertiary"
                    size="md"
                    className="max-[672px]:w-full"
                    disabled={reflecting}
                    onClick={saveReflectionNow}
                  >
                    Save reflection
                  </Button>
                  {reflectError ? (
                    <p
                      role="alert"
                      className="text-label-01 text-support-error"
                    >
                      {reflectError}
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-body-02 text-text-secondary">
                Save your project to add a reflection.
              </p>
            )}
          </Section>
        </div>
      </div>

      <aside
        aria-label="Guidance"
        className="flex flex-col gap-01 max-[672px]:hidden"
      >
        <section className="flex flex-col gap-04 bg-layer-01 p-05">
          <h2 className="text-heading-04">Before you start</h2>
          <ul className="flex flex-col gap-03">
            {BEFORE_YOU_START.map(({ label, ok }) => (
              <li key={label} className="flex gap-03 text-body-02">
                {ok ? (
                  <Checkmark
                    className="ltw-i mt-[2px] text-support-success"
                    aria-hidden="true"
                  />
                ) : (
                  <Close
                    className="ltw-i mt-[2px] text-support-error"
                    aria-hidden="true"
                  />
                )}
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-03 bg-layer-01 p-05">
          <p className="text-label-01 text-text-secondary">
            From this week&apos;s session
          </p>
          <h2 className="text-heading-04">{tip.title}</h2>
          <p className="text-body-02 text-text-secondary">{tip.tip}</p>
        </section>
      </aside>
    </div>
  );
}
