"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  ButtonLink,
  Checkbox,
  ContentSwitcher,
  LikertScale,
  Select,
  SelectableTileGroup,
  TextInput,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import {
  AI_USE,
  CHALLENGES,
  INDUSTRIES,
  TEAM_FUNCTIONS,
  TEAM_SIZES,
} from "@convex/lib/setupOptions";

type Team = FunctionReturnType<typeof api.teams.current>;

const OTHER = "Other";

/** A select that starts blank, so a draft never records a value nobody picked. */
const choose = (empty: string, list: readonly string[]) => [
  { value: "", label: empty },
  ...list.map((value) => ({ value, label: value })),
];

/**
 * 03 on one route: page 1, then `?page=2` (Ruling 34). Each Continue saves, so
 * nothing typed waits in the browser. "Save and exit" in the setup header
 * submits this form with `intent=exit` (Ruling 10).
 * ponytail: no live query; the fields are the viewer's own edits.
 */
export function TeamForm({ page, initial }: { page: 1 | 2; initial: Team }) {
  const expectOrgId = useExpectOrgId();
  const router = useRouter();
  const saveProfile = useMutation(api.teams.saveProfile);
  const [sizeBand, setSizeBand] = useState(initial?.sizeBand ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [teamFunction, setTeamFunction] = useState(initial?.teamFunction ?? "");
  const [aiUse, setAiUse] = useState(initial?.aiUse ?? null);
  const [challenges, setChallenges] = useState(initial?.challenges ?? []);
  const [other, setOther] = useState(initial?.challengeOther ?? "");
  const [confidence, setConfidence] = useState(
    initial?.normsConfidence ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (challenge: string, on: boolean) =>
    setChallenges((list) =>
      on ? [...list, challenge] : list.filter((c) => c !== challenge),
    );

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const exit =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "exit";
    setError(null);
    startTransition(async () => {
      try {
        await saveProfile({
          expectOrgId,
          sizeBand: sizeBand || undefined,
          industry: industry || undefined,
          teamFunction: teamFunction || undefined,
          aiUse: aiUse ?? undefined,
          challenges,
          challengeOther:
            challenges.includes(OTHER) && other.trim()
              ? other.trim()
              : undefined,
          normsConfidence: confidence ?? undefined,
          finish: page === 2 && !exit,
        });
        router.push(
          exit
            ? "/manager"
            : page === 1
              ? "/setup/team?page=2"
              : "/setup/protected-hour",
        );
      } catch (error) {
        setError(userMessage(error, "We couldn't save your team. Try again."));
      }
    });
  }

  return (
    <form
      id="setup-form"
      onSubmit={onSubmit}
      // Enter in an input would click the header's Save and exit, the form's
      // first submit button in tree order. Continue is a click.
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement)
          e.preventDefault();
      }}
      className="flex flex-1 flex-col gap-07"
    >
      <div className="grid grid-cols-[360px_minmax(0,720px)] gap-10 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-04 pt-03">
          <h1 className="text-display-03">
            {page === 1 ? "Tell us about your team" : "What gets in the way?"}
          </h1>
          <p className="text-body-01 text-text-secondary">
            {page === 1
              ? "A few details so the sprint fits the work your team already does."
              : "We'll tailor the four-week sprint around your team's needs."}
          </p>
          <p className="mt-03 text-label-01 text-text-secondary">
            Page {page} of 2
          </p>
        </div>

        {page === 1 ? (
          <div className="flex flex-col gap-07">
            <div className="flex flex-col gap-03">
              {/* The switcher names its group; this is the same words, for the eye. */}
              <span
                aria-hidden="true"
                className="text-label-01 text-text-secondary"
              >
                Team size
              </span>
              <ContentSwitcher
                label="Team size"
                options={TEAM_SIZES.map((s) => ({ value: s, label: s }))}
                value={sizeBand}
                onChange={setSizeBand}
              />
            </div>
            <div className="grid grid-cols-2 gap-05 max-md:grid-cols-1">
              <Select
                id="team-industry"
                label="Industry"
                options={choose("Choose an industry", INDUSTRIES)}
                value={industry}
                onChange={(e) => setIndustry(e.currentTarget.value)}
              />
              <Select
                id="team-function"
                label="Main team function"
                options={choose("Choose a team function", TEAM_FUNCTIONS)}
                value={teamFunction}
                onChange={(e) => setTeamFunction(e.currentTarget.value)}
              />
            </div>
            <SelectableTileGroup
              legend="How does your team use AI today?"
              name="aiUse"
              options={AI_USE.map((o) => ({
                value: o.label,
                title: o.label,
                description: o.description,
              }))}
              value={aiUse}
              onChange={setAiUse}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-07">
            <fieldset className="min-w-0">
              <legend className="mb-03 text-label-01 text-text-secondary">
                Main challenges (select all that apply)
              </legend>
              <div className="grid grid-cols-2 gap-x-06 gap-y-02 max-md:grid-cols-1">
                {CHALLENGES.map((c) => (
                  <Checkbox
                    key={c}
                    label={c}
                    checked={challenges.includes(c)}
                    onChange={(e) => toggle(c, e.currentTarget.checked)}
                    className="flex min-h-control-sm items-center"
                  />
                ))}
              </div>
            </fieldset>
            {challenges.includes(OTHER) && (
              <TextInput
                id="team-challenge-other"
                label="Tell us more"
                placeholder="For example, leadership wants a policy before anyone experiments"
                maxLength={200}
                value={other}
                onChange={(e) => setOther(e.currentTarget.value)}
              />
            )}
            <LikertScale
              name="normsConfidence"
              legend="How confident do you feel setting AI norms for your team today? (1 is not at all, 5 is very)"
              value={confidence}
              onChange={setConfidence}
              minLabel="Not at all"
              maxLabel="Very"
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="self-end text-label-01 text-support-error">
          {error}
        </p>
      )}
      <div className="-mx-10 mt-auto flex justify-end border-t border-border-subtle max-md:-mx-05">
        <ButtonLink
          kind="secondary"
          size="xl"
          href={page === 1 ? "/" : "/setup/team"}
          className="w-60 max-md:w-auto max-md:flex-1"
        >
          Back
        </ButtonLink>
        <Button
          type="submit"
          size="xl"
          icon={ArrowRight}
          disabled={pending}
          className="w-60 max-md:w-auto max-md:flex-1"
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
