"use client";

import { Add, ArrowRight, TrashCan } from "@carbon/icons-react";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type SubmitEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { addDays, dayOf } from "@convex/lib/sprintTime";
import {
  Avatar,
  Button,
  ButtonLink,
  Checkbox,
  InlineNotification,
  Tag,
  TextInput,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { dateLabel, dayMonth, hourSpan } from "@/lib/careers/when";

/** As `crews.proposeRule` checks them, so a rule written before joining can't fail after. */
const MAX_RULE = 120;
const MAX_PROPOSALS = 3;

function Proposed({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="flex items-center gap-03 pl-07">
      <Tag>Proposed by you</Tag>
      <Button kind="ghost" size="sm" icon={TrashCan} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

export function JoinCrew({
  crew: preloadedCrew,
  rules: preloadedRules,
  target,
}: {
  crew: Preloaded<typeof api.careers.crews.mine>;
  rules: Preloaded<typeof api.careers.crews.rules>;
  target: string | null;
}) {
  const crew = usePreloadedQuery(preloadedCrew);
  const rules = usePreloadedQuery(preloadedRules);
  const router = useRouter();
  const toast = useToast();
  const join = useMutation(api.careers.crews.joinCrew);
  const toggle = useMutation(api.careers.crews.toggleRule);
  const propose = useMutation(api.careers.crews.proposeRule);
  const remove = useMutation(api.careers.crews.removeMyRule);
  const agree = useMutation(api.careers.crews.agree);
  // Before joining, choices and proposals stay here and are written on Join.
  const [choices, setChoices] = useState<Record<Id<"crewRules">, boolean>>({});
  const [drafts, setDrafts] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!crew) {
    return (
      <main className="flex flex-1 flex-col gap-06 px-05 pt-06 pb-07 lg:max-w-[720px] lg:px-07 lg:py-07">
        <h1 className="text-heading-01 text-balance">Meet your crew</h1>
        <InlineNotification title="No crew has room yet.">
          We&apos;ll add you to the next crew heading your way.
        </InlineNotification>
      </main>
    );
  }

  const joined = crew.joined;
  const done = joined && crew.agreed;
  const on = (r: (typeof rules)[number]) => choices[r.ruleId] ?? r.on;
  const count = rules.filter(on).length + drafts.length;
  const firstCheckIn = addDays(
    crew.startsOn,
    (crew.checkInDay - dayOf(crew.startsOn) + 7) % 7,
  );
  const weekday = dateLabel(firstCheckIn, "long").split(" ")[0];

  async function onToggle(ruleId: Id<"crewRules">, next: boolean) {
    setChoices((c) => ({ ...c, [ruleId]: next }));
    if (!joined) return;
    try {
      await toggle({ ruleId, on: next });
    } catch (e) {
      setChoices((c) => ({ ...c, [ruleId]: !next }));
      setError(userMessage(e, "That change wasn't saved. Try again."));
    }
  }

  async function onAdd(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const rule = text.trim();
    const mine = rules.filter((r) => r.mine).length + drafts.length;
    if (!rule) return setRuleError("Write your rule first.");
    if (rule.length > MAX_RULE)
      return setRuleError(`Keep your rule to ${MAX_RULE} characters.`);
    if (mine >= MAX_PROPOSALS)
      return setRuleError(
        `You can propose up to ${MAX_PROPOSALS} rules at a time.`,
      );
    setRuleError(null);
    if (!joined) {
      setDrafts((d) => [...d, rule]);
      setText("");
      return;
    }
    try {
      await propose({ text: rule });
      setText("");
    } catch (err) {
      setRuleError(userMessage(err, "Your rule wasn't added. Try again."));
    }
  }

  async function onJoin() {
    setPending(true);
    setError(null);
    try {
      // Each is a no-op the second time, so a retry after a failure is safe.
      await join({});
      for (const r of rules) {
        const choice = choices[r.ruleId];
        if (choice !== undefined && choice !== r.on)
          await toggle({ ruleId: r.ruleId, on: choice });
      }
      for (const rule of drafts) await propose({ text: rule });
      setDrafts([]);
      await agree({});
      toast({ title: "You're in.", body: "Next, protect your hours." });
      // The side nav's next check-in is the layout's: read it again.
      router.refresh();
    } catch (e) {
      setError(userMessage(e, "You weren't added to the crew. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <main className="flex flex-1 flex-col gap-06 px-05 pt-06 pb-07 lg:max-w-[720px] lg:px-07 lg:py-07">
        <h1 className="text-heading-01 text-balance">Meet your crew</h1>

        <section
          aria-label="Your guide"
          className="flex items-start gap-05 bg-layer-01 p-05"
        >
          <span aria-hidden="true" className="ltw-av size-[48px] text-body-02">
            {crew.guide.initials}
          </span>
          <div className="flex flex-col gap-02">
            <span className="text-label-01 text-text-secondary">
              Pathway Guide
            </span>
            <h2 className="text-heading-04">{crew.guide.firstName}</h2>
            {crew.guide.bio && (
              <p className="text-body-02 text-text-secondary">
                {crew.guide.bio}
              </p>
            )}
          </div>
        </section>

        <div className="flex items-start gap-05 border-b border-border-subtle pb-06">
          <ul aria-label="Your crew" className="flex shrink-0 gap-01">
            {crew.members.map((m, i) => (
              <li key={i}>
                <Avatar initials={m.initials} manager={false} />
              </li>
            ))}
          </ul>
          <p className="text-body-02">
            <b className="font-semibold">
              {crew.members.length} changers heading to{" "}
              {target ?? "your target role"}.
            </b>{" "}
            Check-ins {weekday}s, {hourSpan(crew.checkInTime)}, from{" "}
            {dayMonth(firstCheckIn)}.
          </p>
        </div>

        <section aria-labelledby="agreement" className="flex flex-col gap-04">
          <div className="flex flex-col gap-02">
            <div className="flex items-baseline justify-between gap-05">
              <h2 id="agreement" className="text-heading-04">
                Crew Agreement
              </h2>
              <span className="text-label-01 text-text-secondary tabular-nums">
                {count} {count === 1 ? "rule" : "rules"}
              </span>
            </div>
            <p className="text-label-01 text-text-secondary">
              Drafted by {crew.guide.firstName}. Untick what you&apos;d change,
              or add your own.
            </p>
          </div>
          <ul className="flex flex-col">
            {rules.map((r) => (
              <li
                key={r.ruleId}
                className="flex flex-col gap-02 border-b border-border-subtle lg:py-03"
              >
                <Checkbox
                  label={
                    <span className={on(r) ? "" : "text-text-secondary"}>
                      {r.text}
                    </span>
                  }
                  helper={
                    r.mine
                      ? "Your crew votes on it at the first check-in"
                      : undefined
                  }
                  checked={on(r)}
                  onChange={(e) =>
                    void onToggle(r.ruleId, e.currentTarget.checked)
                  }
                />
                {r.mine && (
                  <Proposed
                    onRemove={() =>
                      void remove({ ruleId: r.ruleId }).catch((e: unknown) =>
                        setError(
                          userMessage(
                            e,
                            "Your rule wasn't removed. Try again.",
                          ),
                        ),
                      )
                    }
                  />
                )}
              </li>
            ))}
            {drafts.map((rule, i) => (
              <li
                key={`${i}-${rule}`}
                className="flex flex-col gap-02 border-b border-border-subtle lg:py-03"
              >
                <Checkbox
                  label={rule}
                  helper="Your crew votes on it at the first check-in"
                  checked
                  disabled
                />
                <Proposed
                  onRemove={() => setDrafts((d) => d.filter((_, j) => j !== i))}
                />
              </li>
            ))}
          </ul>
          <form onSubmit={onAdd} className="flex items-start">
            <div className="min-w-0 flex-1">
              <TextInput
                id="own-rule"
                label="Add your own rule"
                placeholder="For example, cameras on for demos"
                value={text}
                maxLength={MAX_RULE}
                error={ruleError ?? undefined}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            {/* 24px: the label and its gap, so the button lines up with the field. */}
            <Button
              type="submit"
              kind="secondary"
              size="md"
              icon={Add}
              className="mt-06"
            >
              Add
            </Button>
          </form>
        </section>

        <div className="bg-layer-01 p-05">
          <Checkbox
            label="I agree to this Crew Agreement."
            helper={`Your crew sees "done this week", never scores or time spent.`}
            checked={crew.agreed || agreed}
            disabled={crew.agreed}
            onChange={(e) => setAgreed(e.currentTarget.checked)}
          />
        </div>
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </main>
      <div className="ltw-cf lg:static lg:max-w-[720px] lg:border-0 lg:px-07 lg:pt-0">
        {done ? (
          <ButtonLink
            href="/careers/crew/hours"
            icon={ArrowRight}
            className="w-full lg:w-auto"
          >
            Protect your hours
          </ButtonLink>
        ) : (
          <Button
            icon={ArrowRight}
            className="w-full lg:w-auto"
            disabled={!agreed || pending}
            onClick={() => void onJoin()}
          >
            Join this crew
          </Button>
        )}
      </div>
    </>
  );
}
