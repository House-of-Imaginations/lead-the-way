"use client";

import { Copy, Launch, Share } from "@carbon/icons-react";
import Link from "next/link";
import { useId, useState } from "react";
import type { CredentialId } from "@convex/lib/careers/catalog";
import { Button, Toggle, useToast } from "@/components/ui";
import {
  createProofLink,
  rateConfidence,
  setCareerSetting,
  setReflectionOnProof,
} from "@/lib/careers/actions";

/** "Add to LinkedIn" is simulated (screen 6): a toast, no third party. */
export function AddToLinkedIn() {
  const toast = useToast();
  return (
    <Button
      kind="tertiary"
      icon={Share}
      className="w-full lg:w-auto"
      onClick={() =>
        toast({
          title: "Added to LinkedIn.",
          body: "Simulated in this prototype. Nothing was posted.",
        })
      }
    >
      Add to LinkedIn
    </Button>
  );
}

const WORDS = [
  "Not yet confident",
  "A little confident",
  "Somewhat confident",
  "Fairly confident",
  "Very confident",
];

/** The Test Card measure, 1 to 5, private to the learner. Saved as it moves. */
export function Confidence({
  credentialId,
  initial,
}: {
  credentialId: CredentialId;
  initial: number | null;
}) {
  const id = useId();
  const [value, setValue] = useState(initial ?? 3);
  const [error, setError] = useState<string | null>(null);
  const text = `${value} of 5: ${WORDS[value - 1]}`;
  return (
    <div className="flex flex-col gap-04">
      <label htmlFor={id} className="text-heading-04">
        How confident are you about your next career step?
      </label>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        aria-valuetext={text}
        className="h-06 w-full accent-interactive"
        onChange={(e) => {
          const next = Number(e.target.value);
          setValue(next);
          setError(null);
          void rateConfidence(credentialId, next).then((r) =>
            setError(r?.error ?? null),
          );
        }}
      />
      <div className="flex justify-between gap-03 text-label-01 text-text-secondary">
        <span aria-hidden="true">Not yet</span>
        <span className="tabular-nums">{text}</span>
        <span aria-hidden="true">Very</span>
      </div>
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The shareable proof link and its two switches (P5): the reflection shows on
 * `/proof/[slug]` only when both are on.
 */
export function ShareProof({
  credentialId,
  initialSlug,
  reflectionOnProof,
  addReflectionToProof,
}: {
  credentialId: CredentialId;
  initialSlug: string | null;
  reflectionOnProof: boolean;
  /** Null without a project for this credential. */
  addReflectionToProof: boolean | null;
}) {
  const toast = useToast();
  const [slug, setSlug] = useState(initialSlug);
  const [onLinks, setOnLinks] = useState(reflectionOnProof);
  const [onProject, setOnProject] = useState(addReflectionToProof);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = slug ? `/proof/${slug}` : null;

  async function run(
    key: string,
    write: () => Promise<{ error: string } | null>,
    undo: () => void,
  ) {
    setBusy(key);
    setError(null);
    const result = await write();
    if (result) {
      undo();
      setError(result.error);
    } else toast({ title: "Setting saved." });
    setBusy(null);
  }

  return (
    <section
      aria-labelledby="proof-share"
      className="flex flex-col gap-05 border-t border-border-subtle pt-06"
    >
      <div className="flex flex-col gap-03">
        <h2 id="proof-share" className="text-heading-04">
          Share your proof
        </h2>
        <p className="text-body-02 text-text-secondary">
          A link shows your badge, project and endorsement. Never your lessons,
          crew or confidence.
        </p>
      </div>
      {path ? (
        <div className="flex flex-col gap-03">
          <code className="break-all bg-layer-01 p-04 font-mono text-body-02">
            {path}
          </code>
          <div className="flex flex-wrap gap-03">
            <Button
              kind="tertiary"
              size="md"
              icon={Copy}
              onClick={() => {
                void navigator.clipboard
                  .writeText(new URL(path, location.origin).href)
                  .then(() => toast({ title: "Link copied." }));
              }}
            >
              Copy link
            </Button>
            <Link
              href={path}
              target="_blank"
              className="inline-flex items-center gap-03 text-body-02 text-link hover:text-link-hover"
            >
              Open page
              <Launch className="ltw-i" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <Button
          kind="tertiary"
          className="self-start"
          disabled={busy === "link"}
          onClick={async () => {
            setBusy("link");
            setError(null);
            const result = await createProofLink(credentialId);
            if ("slug" in result) setSlug(result.slug);
            else setError(result.error);
            setBusy(null);
          }}
        >
          Create link
        </Button>
      )}
      <div className="flex flex-col border-t border-border-subtle">
        <Toggle
          id="proof-reflectionOnProof"
          label="Show my reflection on shared proof links"
          description="Only on links you choose to share."
          checked={onLinks}
          pending={busy === "links"}
          onChange={(on) => {
            setOnLinks(on);
            void run(
              "links",
              () => setCareerSetting("reflectionOnProof", on),
              () => setOnLinks(!on),
            );
          }}
        />
        {onProject !== null && (
          <Toggle
            id="proof-addReflectionToProof"
            label="Add this reflection to my proof"
            description="Both switches on to show it."
            checked={onProject}
            pending={busy === "project"}
            onChange={(on) => {
              setOnProject(on);
              void run(
                "project",
                () => setReflectionOnProof(on),
                () => setOnProject(!on),
              );
            }}
          />
        )}
      </div>
      {error && (
        <p role="alert" className="text-label-01 text-support-error">
          {error}
        </p>
      )}
    </section>
  );
}
