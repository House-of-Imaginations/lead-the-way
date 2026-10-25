"use client";

import {
  ArrowRight,
  CalendarAdd,
  Checkmark,
  CheckmarkFilled,
  CircleDash,
  Headphones,
  PlayFilledAlt,
  Video,
  ViewOff,
} from "@carbon/icons-react";
import clsx from "clsx";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { dayOf } from "@convex/lib/sprintTime";
import { CalendarMenu } from "@/components/app/CalendarMenu";
import {
  Avatar,
  Button,
  ButtonLink,
  InlineNotification,
  ProgressBar,
  Tag,
  Toggle,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { checkInLabel, dateLabel } from "@/lib/careers/when";

type Person = { firstName: string; initials: string };

export function ThisWeek({
  week: preloaded,
  hours,
  guide,
  others,
}: {
  week: Preloaded<typeof api.careers.learning.thisWeek>;
  hours: number;
  guide: Person;
  /** The crew without you. */
  others: Person[];
}) {
  const week = usePreloadedQuery(preloaded);
  const complete = useMutation(api.careers.learning.completeLesson);
  const setListenOn = useMutation(api.careers.learning.setListen);
  const toast = useToast();
  const [listen, setListen] = useState(week?.listenInstead ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The page redirects before a crew; a deleted track mid-visit lands here.
  if (!week) return null;

  const current = week.lessons.find((l) => !l.done);
  const crew = [guide, ...others];
  const lead = `About ${hours} ${hours === 1 ? "hour" : "hours"}, in lessons of 15 minutes.`;

  async function onComplete(lessonId: string) {
    setPending(true);
    setError(null);
    try {
      await complete({ lessonId });
      toast({
        title: "Lesson complete.",
        body: `${week!.done + 1} of ${week!.total} lessons`,
      });
    } catch (e) {
      setError(userMessage(e, "That lesson wasn't saved. Try again."));
    } finally {
      setPending(false);
    }
  }

  async function onListen(on: boolean) {
    setListen(on);
    try {
      await setListenOn({ on });
    } catch (e) {
      setListen(!on);
      setError(userMessage(e, "That change wasn't saved. Try again."));
    }
  }

  // The week done: demo day on a phone, the credential on a laptop (5, D5).
  const action = (className: string) =>
    current ? (
      <Button
        icon={Checkmark}
        className={className}
        disabled={pending}
        onClick={() => void onComplete(current.lessonId)}
      >
        Mark lesson complete
      </Button>
    ) : (
      <>
        <ButtonLink
          href="/careers/crew/demo-day"
          icon={ArrowRight}
          className={clsx(className, "lg:hidden")}
        >
          Go to demo day
        </ButtonLink>
        <ButtonLink
          href="/careers/proof"
          icon={ArrowRight}
          className={clsx(className, "hidden lg:inline-flex")}
        >
          See your credential
        </ButtonLink>
      </>
    );

  return (
    <>
      <main className="grid flex-1 content-start gap-06 px-05 pt-06 pb-07 lg:grid-cols-[minmax(0,656px)_minmax(0,408px)] lg:gap-[40px] lg:px-[40px] lg:py-07">
        <div className="flex flex-col gap-06">
          <div className="flex flex-col gap-03">
            <span className="self-start">
              <Tag color="blue">{`Credential ${week.credentialNumber} of ${week.credentialCount}, week ${week.week}`}</Tag>
            </span>
            <h1 className="text-heading-01 text-balance">
              This week
              <span className="hidden lg:inline">: {week.credentialName}</span>
            </h1>
            <p className="text-body-01 text-text-secondary">
              <span className="lg:hidden">
                {week.credentialName}. {lead}
              </span>
              <span className="hidden lg:inline">
                {lead} Finish with one job-style project step.
              </span>
            </p>
          </div>

          <ProgressBar
            label="Credential progress"
            value={week.done}
            max={week.total}
            valueText={`${week.done} of ${week.total} lessons`}
          />

          <ul className="flex flex-col gap-01">
            {week.lessons.map((l) => {
              const now = l === current;
              const Icon = l.done
                ? CheckmarkFilled
                : now
                  ? PlayFilledAlt
                  : CircleDash;
              return (
                <li
                  key={l.lessonId}
                  aria-current={now ? "step" : undefined}
                  className={clsx(
                    "flex items-center gap-04 px-05 py-[14px]",
                    now
                      ? "border-l-[3px] border-interactive bg-highlight pl-[13px]"
                      : "bg-layer-01",
                  )}
                >
                  <Icon
                    className={clsx(
                      "ltw-i",
                      l.done
                        ? "text-support-success"
                        : now
                          ? "text-interactive"
                          : "text-text-secondary",
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex flex-1 flex-col">
                    <span>
                      <span className="sr-only">
                        {l.done ? "Done: " : now ? "Next: " : "To do: "}
                      </span>
                      {l.title}
                    </span>
                    {l.kind === "project" && (
                      <span className="text-label-01 text-text-secondary">
                        Job-style project for your portfolio
                      </span>
                    )}
                  </span>
                  <span className="text-label-01 text-text-secondary tabular-nums">
                    {listen && l.hasAudio ? "Listen, " : ""}
                    {l.minutes} min
                  </span>
                </li>
              );
            })}
          </ul>
          {error && (
            <p role="alert" className="text-label-01 text-support-error">
              {error}
            </p>
          )}

          <div className="hidden items-center gap-05 lg:flex">
            {action("")}
            <p className="text-label-01 text-text-secondary">
              Your crew sees &quot;done this week&quot;, never scores.
            </p>
          </div>

          {week.comingUp && (
            <section
              aria-labelledby="coming-up"
              className="hidden flex-col gap-04 border-t border-border-subtle pt-06 lg:flex"
            >
              <div className="flex items-baseline justify-between gap-05">
                <h2 id="coming-up" className="text-heading-04">
                  Coming up in week {week.week + 1}
                </h2>
                <span className="text-label-01 text-text-secondary">
                  Opens {dateLabel(week.comingUp.opensOn, "long")}
                </span>
              </div>
              <ul className="flex flex-col">
                {week.comingUp.lessons.map((l) => (
                  <li
                    key={l.lessonId}
                    className="flex items-center justify-between gap-05 border-b border-border-subtle py-03 text-text-secondary"
                  >
                    {l.title}
                    <span className="text-label-01 tabular-nums">
                      {l.minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-06 lg:gap-05">
          <section
            aria-labelledby="check-in"
            className="order-2 flex flex-col gap-04 bg-layer-01 p-05 lg:order-1"
          >
            <div className="flex items-start justify-between gap-05">
              <h2 id="check-in" className="text-heading-04">
                Crew check-in
                <span className="lg:hidden">
                  , {checkInLabel(week.checkIn.date, week.checkIn.time)}
                </span>
              </h2>
              <Video className="ltw-i" aria-hidden="true" />
            </div>
            <p className="hidden text-heading-03 font-light lg:block">
              {checkInLabel(week.checkIn.date, week.checkIn.time, "long")}
            </p>
            <p className="text-body-02 text-text-secondary">
              Share one thing you tried this week.
            </p>
            <div className="flex items-center gap-04">
              <ul aria-label="Your guide and crew" className="flex">
                {crew.map((p, i) => (
                  <li key={i} className={i < 3 ? "" : "hidden lg:block"}>
                    <Avatar initials={p.initials} manager={i === 0} />
                  </li>
                ))}
              </ul>
              <span className="text-label-01 text-text-secondary lg:hidden">
                {others.length
                  ? `${guide.firstName} and ${others.length} others`
                  : guide.firstName}
              </span>
            </div>
            <div className="hidden lg:block">
              <CalendarMenu
                hour={{
                  title: "Crew check-in",
                  weeks: 1,
                  startDate: week.checkIn.date,
                  // The crew's wall clock, as `crewWeek` works it out.
                  timeZone: "Australia/Melbourne",
                  protectedHour: {
                    weekday: dayOf(week.checkIn.date),
                    start: week.checkIn.time,
                    durationMinutes: 60,
                  },
                }}
                trigger={
                  <Button
                    kind="tertiary"
                    size="md"
                    icon={CalendarAdd}
                    className="w-full"
                  >
                    Add to calendar
                  </Button>
                }
              />
            </div>
          </section>

          <div className="order-1 flex items-start gap-04 border-y border-border-subtle py-02 lg:order-2 lg:border lg:px-05 [&_.ltw-trow]:border-0">
            <Headphones className="ltw-i mt-[18px]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <Toggle
                id="listen"
                label="Low energy? Listen instead"
                description="Audio version with captions and a transcript"
                checked={listen}
                onChange={(on) => void onListen(on)}
              />
            </div>
          </div>

          <div className="order-3">
            <p className="flex items-start gap-03 text-label-01 text-text-secondary lg:hidden">
              <ViewOff className="ltw-i mt-[2px]" aria-hidden="true" />
              Private by design. Your crew sees &quot;done this week&quot;,
              never scores. Your employer sees nothing.
            </p>
            <div className="hidden lg:block">
              <InlineNotification icon={ViewOff} title="Private by design.">
                Your employer never sees your map or your progress.
              </InlineNotification>
            </div>
          </div>
        </aside>
      </main>
      <div className="ltw-cf lg:hidden">{action("w-full")}</div>
    </>
  );
}
