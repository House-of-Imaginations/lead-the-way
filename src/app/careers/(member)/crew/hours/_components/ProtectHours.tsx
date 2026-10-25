"use client";

import { ArrowRight, Checkmark, ViewOff } from "@carbon/icons-react";
import clsx from "clsx";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { addDays, clockLabel, mondayOf } from "@convex/lib/sprintTime";
import {
  Button,
  ButtonLink,
  Checkbox,
  Select,
  useToast,
} from "@/components/ui";
import { userMessage } from "@/lib/errors";
import { timeLabel } from "@/lib/careers/when";

/** Monday first, as `Date#getDay` numbers them (0 is Sunday). */
const DAYS = [
  { day: 1, short: "Mon", grid: "Mo", every: "Mondays" },
  { day: 2, short: "Tue", grid: "Tu", every: "Tuesdays" },
  { day: 3, short: "Wed", grid: "We", every: "Wednesdays" },
  { day: 4, short: "Thu", grid: "Th", every: "Thursdays" },
  { day: 5, short: "Fri", grid: "Fr", every: "Fridays" },
  { day: 6, short: "Sat", grid: "Sa", every: "Saturdays" },
  { day: 0, short: "Sun", grid: "Su", every: "Sundays" },
];
const TIMES = ["06:00", "07:00", "12:00", "19:00", "20:00", "21:00"].map(
  (value) => ({ value, label: clockLabel(value) }),
);
const LEARNING = "bg-interactive text-text-on-color";
const CREW = "bg-border-inverse text-text-inverse";
const SWAP = [
  "",
  "Picking another swaps it out.",
  "Picking a third swaps out the oldest.",
  "Picking a fourth swaps out the oldest.",
];

export function ProtectHours({
  hoursPerWeek,
  saved,
  startsOn,
  checkInDay,
  checkInTime,
}: {
  hoursPerWeek: number;
  saved: { days: number[]; startTime: string; calendarHold: boolean } | null;
  startsOn: string;
  checkInDay: number;
  checkInTime: string;
}) {
  const save = useMutation(api.careers.hours.save);
  const toast = useToast();
  // In the order picked, so one more swaps out the oldest.
  const [days, setDays] = useState(saved?.days ?? []);
  const [start, setStart] = useState(saved?.startTime ?? "20:00");
  const [hold, setHold] = useState(saved?.calendarHold ?? true);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const want = hoursPerWeek;
  const monday = mondayOf(startsOn);

  function pick(day: number) {
    setDone(false);
    setDays((d) =>
      d.includes(day) ? d.filter((x) => x !== day) : [...d, day].slice(-want),
    );
  }

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      await save({ days, startTime: start, calendarHold: hold });
      const names = DAYS.filter((d) => days.includes(d.day)).map(
        (d) => d.every,
      );
      toast({
        title: "Hours protected.",
        body: `${names.join(" and ")} at ${timeLabel(start)}.`,
      });
      setDone(true);
    } catch (e) {
      setError(userMessage(e, "Your hours weren't saved. Try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <main className="flex flex-1 flex-col gap-06 px-05 pt-06 pb-07 lg:max-w-[720px] lg:px-07 lg:py-07">
        <div className="flex flex-col gap-03">
          <h1 className="text-heading-01 text-balance">Protect your hours</h1>
          <p className="text-body-01 text-text-secondary">
            You chose {want} {want === 1 ? "hour" : "hours"} a week. Pick the
            days you&apos;ll learn and we&apos;ll hold the time in your
            calendar.
          </p>
        </div>

        <div
          role="group"
          aria-labelledby="learning-days"
          className="flex flex-col gap-03"
        >
          <div className="flex items-baseline justify-between gap-05">
            <span
              id="learning-days"
              className="text-label-01 text-text-secondary"
            >
              Learning days
            </span>
            <span
              aria-live="polite"
              className="text-label-01 text-text-secondary tabular-nums"
            >
              {days.length} of {want} picked
            </span>
          </div>
          <div className="grid grid-cols-7 gap-01">
            {DAYS.map(({ day, short }) => (
              <button
                key={day}
                type="button"
                aria-pressed={days.includes(day)}
                onClick={() => pick(day)}
                className={clsx(
                  "h-[40px] border text-body-02",
                  days.includes(day)
                    ? "border-border-inverse bg-border-inverse text-text-inverse"
                    : "border-border-strong bg-background hover:bg-layer-hover",
                )}
              >
                {short}
              </button>
            ))}
          </div>
          <p className="text-label-01 text-text-secondary">
            Pick {want} {want === 1 ? "day" : "days"}, 1 hour each. {SWAP[want]}
          </p>
        </div>

        <Select
          id="start-time"
          label="Start time"
          options={TIMES}
          value={start}
          onChange={(e) => {
            setDone(false);
            setStart(e.target.value);
          }}
        />

        <section aria-labelledby="first-weeks" className="flex flex-col gap-04">
          <h2 id="first-weeks" className="text-heading-04">
            Your first 4 weeks
          </h2>
          <table className="w-full table-fixed border-separate border-spacing-[2px] text-center text-label-01">
            <thead>
              <tr>
                <td className="w-[56px]" />
                {DAYS.map((d) => (
                  <th
                    key={d.day}
                    scope="col"
                    abbr={d.every.slice(0, -1)}
                    className="font-normal text-text-secondary"
                  >
                    {d.grid}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((w) => (
                <tr key={w}>
                  <th
                    scope="row"
                    className="text-left font-normal text-text-secondary"
                  >
                    Week {w + 1}
                  </th>
                  {DAYS.map(({ day }, i) => {
                    const date = addDays(monday, 7 * w + i);
                    const isLearning = days.includes(day);
                    const isCrew = day === checkInDay;
                    const n = Number(date.slice(8));
                    return (
                      <td
                        key={day}
                        className={clsx(
                          "h-[28px]",
                          isLearning
                            ? LEARNING
                            : isCrew
                              ? CREW
                              : "bg-layer-01 text-text-helper",
                        )}
                      >
                        {isLearning || isCrew ? (
                          <>
                            <span className="sr-only">{n}, </span>
                            {isLearning && isCrew
                              ? "Both"
                              : isCrew
                                ? "Crew"
                                : timeLabel(start)}
                          </>
                        ) : (
                          n
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-wrap gap-x-06 gap-y-02 text-label-01 text-text-secondary">
            <li className="flex items-center gap-03">
              <span
                aria-hidden="true"
                className={clsx("size-[12px]", LEARNING)}
              />
              Learning hour
            </li>
            <li className="flex items-center gap-03">
              <span aria-hidden="true" className={clsx("size-[12px]", CREW)} />
              Crew check-in, {timeLabel(checkInTime)}
            </li>
          </ul>
        </section>

        <div className="bg-highlight p-05">
          <Checkbox
            label="Add a weekly calendar hold"
            helper="Shows as “Busy” in your calendar. The title stays private."
            checked={hold}
            onChange={(e) => {
              setDone(false);
              setHold(e.currentTarget.checked);
            }}
          />
        </div>
        <p className="flex items-center gap-03 text-label-01 text-text-secondary">
          <ViewOff className="ltw-i" aria-hidden="true" />
          Busy week? Move a block any time. Nobody is told.
        </p>
        {error && (
          <p role="alert" className="text-label-01 text-support-error">
            {error}
          </p>
        )}
      </main>
      <div className="ltw-cf lg:static lg:max-w-[720px] lg:border-0 lg:px-07 lg:pt-0">
        {done ? (
          <ButtonLink
            href="/careers/week"
            icon={ArrowRight}
            className="w-full lg:w-auto"
          >
            Go to this week
          </ButtonLink>
        ) : (
          <Button
            icon={Checkmark}
            className="w-full lg:w-auto"
            disabled={days.length !== want || pending}
            onClick={() => void onSave()}
          >
            Save my hours
          </Button>
        )}
      </div>
    </>
  );
}
