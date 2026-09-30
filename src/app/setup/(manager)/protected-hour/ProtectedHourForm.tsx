"use client";

import { Locked } from "@carbon/icons-react";
import clsx from "clsx";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition, type SubmitEvent } from "react";
import { useExpectOrgId } from "@/components/app/ExpectOrgId";
import {
  Button,
  ButtonLink,
  Checkbox,
  ContentSwitcher,
  Select,
  TextInput,
} from "@/components/ui";
import type { CalendarHour } from "@/lib/calendar";
import { userMessage } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import { HOUR_STARTS } from "@convex/lib/setupOptions";
import { addDays, hourPattern } from "@convex/lib/sprintTime";
import { CalendarMenu } from "./CalendarMenu";
import { NotReadyDialog } from "./NotReadyDialog";

type Current = NonNullable<FunctionReturnType<typeof api.sprints.current>>;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-09-07" as "7 Sep". */
function dayMonth(date: string) {
  return `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}

/** "14:00" as "2:00 PM". */
function timeLabel(start: string) {
  const h = Number(start.slice(0, 2));
  return `${h % 12 || 12}:${start.slice(3)} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * 04. The day and time are local until a submit: Protect commits and opens
 * the pathway, and the header's Save and exit (`intent=exit`) saves them as a
 * draft (Ruling 10). The preview is worked out here from `weekOneMonday`, so
 * it moves as soon as a day is picked.
 */
export function ProtectedHourForm({ initial }: { initial: Current }) {
  const expectOrgId = useExpectOrgId();
  const router = useRouter();
  const setProtectedHour = useMutation(api.sprints.setProtectedHour);
  const commit = useMutation(api.sprints.commit);
  const [weekday, setWeekday] = useState(initial.weekday);
  const [start, setStart] = useState(initial.start);
  // The saved commitment changes only through Protect or Not ready; Save and
  // exit saves the hour and leaves it as it was, ticked or not.
  const [ticked, setTicked] = useState(initial.committed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const monday = initial.weekOneMonday;
  const hour: CalendarHour = {
    startDate: addDays(monday, weekday - 1),
    timeZone: initial.timeZone,
    protectedHour: { weekday, start, durationMinutes: 60 },
    title: "Protected learning hour",
    weeks: initial.weeks,
  };
  const block = `Learn ${timeLabel(start).replace(":00", "")}`;

  function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const exit = e.nativeEvent.submitter?.getAttribute("value") === "exit";
    setError(null);
    startTransition(async () => {
      try {
        if (exit) await setProtectedHour({ expectOrgId, weekday, start });
        else await commit({ expectOrgId, weekday, start });
        router.push(exit ? "/manager" : "/manager/learning");
      } catch (error) {
        setError(userMessage(error, "We couldn't save the hour. Try again."));
      }
    });
  }

  return (
    <form
      id="setup-form"
      onSubmit={onSubmit}
      // Enter in an input, or a select in Chromium, would click the header's
      // Save and exit, the form's first submit button in tree order. Protect
      // is a click.
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          (e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLSelectElement)
        )
          e.preventDefault();
      }}
      className="flex flex-1 flex-col gap-07"
    >
      <div className="grid grid-cols-[minmax(0,560px)_minmax(0,1fr)] gap-10 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-07">
          <div className="flex flex-col gap-04">
            <h1 className="text-display-03">
              Make learning part of the working week
            </h1>
            <p className="text-body-01 text-text-secondary">
              The sprint works only if learning does not have to compete with
              leftover personal time.
            </p>
          </div>
          <div className="flex flex-col gap-03">
            {/* The switcher names its group; this is the same words, for the eye. */}
            <span
              aria-hidden="true"
              className="text-label-01 text-text-secondary"
            >
              Weekly learning day
            </span>
            {/* 04 shows the day over its date: two lines per segment, full width. */}
            <div className="[&_button]:h-auto [&_button]:flex-1 [&_button]:py-03 [&_button]:text-label-01 [&_button]:whitespace-pre-line [&>div]:w-full">
              <ContentSwitcher
                label="Weekly learning day"
                options={DAYS.map((d, i) => ({
                  value: String(i + 1),
                  label: `${d}\n${dayMonth(addDays(monday, i))}`,
                }))}
                value={String(weekday)}
                onChange={(v) => setWeekday(Number(v))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-05 max-md:grid-cols-1">
            <Select
              id="hour-start"
              label="Start time"
              options={HOUR_STARTS.map((s) => ({
                value: s,
                label: timeLabel(s),
              }))}
              value={start}
              onChange={(e) => setStart(e.currentTarget.value)}
            />
            <TextInput
              id="hour-duration"
              label="Duration"
              value="1 hour"
              disabled
              readOnly
            />
          </div>
          <div
            className={clsx("p-05", ticked ? "bg-highlight" : "bg-layer-01")}
          >
            <Checkbox
              label={
                <span className="font-semibold">
                  I will protect this hour from normal meetings where reasonably
                  possible.
                </span>
              }
              helper="Your team can change individual timing if operational needs require flexibility."
              checked={ticked}
              onChange={(e) => setTicked(e.currentTarget.checked)}
            />
          </div>
          {error && (
            <p role="alert" className="text-label-01 text-support-error">
              {error}
            </p>
          )}
        </div>

        <section
          aria-label="Calendar preview"
          className="flex min-w-0 flex-col gap-05 self-start bg-layer-01 p-06 max-md:p-05"
        >
          <div className="flex flex-wrap items-start justify-between gap-06">
            <div className="flex flex-col gap-02">
              <h2 className="text-heading-03">
                {hourPattern(weekday, start, 60)}
              </h2>
              <p className="text-text-secondary">
                Added to your team&apos;s calendars when you launch
              </p>
              <CalendarMenu hour={hour} />
            </div>
            {initial.teamHours !== null && (
              <p className="flex flex-col items-end">
                <span className="text-heading-02 tabular-nums">
                  {initial.teamHours} hrs
                </span>
                <span className="text-label-01 text-text-secondary">
                  paid time a week, team total
                </span>
              </p>
            )}
          </div>
          {/* On a phone the week column and paddings shrink, so "Learn 2 PM" fits. */}
          <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-01 text-label-01 tabular-nums max-md:grid-cols-[48px_repeat(5,minmax(0,1fr))]">
            <span />
            {DAYS.map((d) => (
              <span
                key={d}
                className="px-03 pb-02 text-text-secondary max-md:px-02"
              >
                {d}
              </span>
            ))}
            {Array.from({ length: initial.weeks }, (_, w) => (
              <Fragment key={w}>
                <span className="flex items-center text-text-secondary">
                  Week {w + 1}
                </span>
                {DAYS.map((d, i) => {
                  const on = i + 1 === weekday;
                  return (
                    <div
                      key={d}
                      className={clsx(
                        "flex min-h-16 flex-col gap-03 p-03 max-md:p-02",
                        on
                          ? "bg-highlight text-link"
                          : "bg-background text-text-secondary",
                      )}
                    >
                      {dayMonth(addDays(monday, w * 7 + i))}
                      {on && (
                        <span className="bg-interactive px-03 py-01 text-text-on-color max-md:px-02">
                          {block}
                        </span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </section>
      </div>

      <div className="-mx-10 mt-auto flex flex-wrap items-stretch justify-between border-t border-border-subtle max-md:-mx-05">
        <NotReadyDialog />
        <div className="flex flex-wrap items-stretch max-md:w-full">
          {!ticked && (
            <p
              id="commit-reason"
              className="self-center px-05 text-label-01 text-text-secondary"
            >
              Tick the commitment to continue.
            </p>
          )}
          <ButtonLink
            kind="secondary"
            size="xl"
            href="/setup/team?page=2"
            className="min-w-60 max-md:flex-1"
          >
            Back
          </ButtonLink>
          <Button
            type="submit"
            size="xl"
            icon={Locked}
            disabled={!ticked || pending}
            aria-describedby={ticked ? undefined : "commit-reason"}
            className="min-w-60 max-md:flex-1"
          >
            Protect this learning hour
          </Button>
        </div>
      </div>
    </form>
  );
}
