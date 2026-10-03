"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, LikertScale } from "@/components/ui";
import { userMessage } from "@/lib/errors";

const QUESTIONS = [
  {
    key: "aiConfidence",
    legend: "How confident do you feel using AI at work?",
    minLabel: "Not at all",
    maxLabel: "Very",
  },
  {
    key: "comfortWithManager",
    legend: "I feel comfortable telling my manager how I use AI at work.",
    minLabel: "Strongly disagree",
    maxLabel: "Strongly agree",
  },
] as const;

type Scores = Record<(typeof QUESTIONS)[number]["key"], number | null>;

/**
 * The two check-in questions (Ruling 7). Before: on /join right after
 * joining, skippable. After: a card on /me and /me/show-and-tell, no skip.
 * `expectOrgId` is a prop because /join sits outside the shell.
 */
export function CheckIn({
  phase,
  expectOrgId,
  onDone,
}: {
  phase: "before" | "after";
  expectOrgId: Id<"orgs">;
  onDone: () => void;
}) {
  const checkIn = useMutation(api.surveys.checkIn);
  const [scores, setScores] = useState<Scores>({
    aiConfidence: null,
    comfortWithManager: null,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aiConfidence, comfortWithManager } = scores;
  const complete = aiConfidence !== null && comfortWithManager !== null;

  async function send(
    answers: { aiConfidence: number; comfortWithManager: number } | null,
  ) {
    setPending(true);
    setError(null);
    try {
      await checkIn({ phase, answers, expectOrgId });
      onDone();
    } catch (e) {
      setError(userMessage(e, "Your answers didn't save. Try again."));
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby={`check-in-${phase}`}
      className="flex flex-col gap-06 bg-layer-01 p-05"
    >
      <div className="flex flex-col gap-02">
        <h2 id={`check-in-${phase}`} className="text-heading-03">
          {phase === "before" ? "Before you start" : "How did the sprint go?"}
        </h2>
        <p className="text-body-02 text-text-secondary">
          Two quick questions. Your answers are private to you.
        </p>
      </div>
      {QUESTIONS.map(({ key, ...question }) => (
        <LikertScale
          key={key}
          name={`${phase}-${key}`}
          {...question}
          value={scores[key]}
          onChange={(n) => setScores((s) => ({ ...s, [key]: n }))}
        />
      ))}
      <div className="flex flex-col gap-03">
        <div className="flex flex-wrap gap-03 max-[672px]:flex-col">
          {phase === "before" && (
            <Button
              kind="secondary"
              className="max-[672px]:w-full"
              disabled={pending}
              onClick={() => void send(null)}
            >
              Skip for now
            </Button>
          )}
          <Button
            className="max-[672px]:w-full"
            disabled={!complete || pending}
            onClick={() => {
              if (aiConfidence !== null && comfortWithManager !== null)
                void send({ aiConfidence, comfortWithManager });
            }}
          >
            Save answers
          </Button>
        </div>
        {!complete && (
          <p className="text-label-01 text-text-secondary">
            Pick a number for both questions to save.
          </p>
        )}
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
