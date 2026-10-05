"use client";

import {
  CalendarAdd,
  CheckmarkFilled,
  RadioButton,
  RadioButtonChecked,
} from "@carbon/icons-react";
import clsx from "clsx";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import type { MySprint as MySprintData } from "@convex/me";
import { CalendarMenu } from "@/components/app/CalendarMenu";
import {
  Button,
  InlineNotification,
  ProgressBar,
  Skeleton,
  Tag,
} from "@/components/ui";
import { useHour } from "@/lib/useHour";

type Activity = MySprintData["weeks"][number]["activities"][number];

const ICONS = {
  done: CheckmarkFilled,
  progress: RadioButtonChecked,
  todo: RadioButton,
} as const;

function ActivityRow({ activity }: { activity: Activity }) {
  const Icon = ICONS[activity.state];
  const label = (
    <>
      {activity.state === "done" ? (
        <span className="sr-only">Done: </span>
      ) : null}
      {activity.label}
    </>
  );
  return (
    <li className="flex items-center gap-03 border-t border-border-subtle py-03 text-body-02 max-[672px]:min-h-[48px]">
      <Icon
        size={16}
        aria-hidden="true"
        className={clsx(
          "shrink-0",
          activity.state === "done"
            ? "text-support-success"
            : activity.state === "progress"
              ? "text-interactive"
              : "text-text-secondary",
        )}
      />
      {activity.href ? (
        <Link
          href={activity.href}
          className={clsx(
            "text-link hover:text-link-hover hover:underline",
            activity.state === "progress" && "font-semibold",
          )}
        >
          {label}
        </Link>
      ) : (
        <span>{label}</span>
      )}
    </li>
  );
}

const TITLE = <h1 className="text-heading-01">Your AI sprint</h1>;

export function MySprint() {
  // Review Focus 6: a new hour is a new query, so the next session moves on
  // at 3:00 PM without a reload (Ruling 16).
  const hour = useHour();
  const data = useQuery(api.me.sprint, { hour });

  if (data === undefined) {
    return (
      <div aria-busy="true" className="flex max-w-content-max flex-col gap-07">
        {TITLE}
        <Skeleton className="h-[240px] w-full" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="flex max-w-content-max flex-col gap-07">
        {TITLE}
        <InlineNotification>
          Your sprint appears here once your manager launches it.
        </InlineNotification>
      </div>
    );
  }

  return (
    <div className="flex max-w-content-max flex-col gap-07">
      <header className="flex items-end justify-between gap-07 max-[900px]:flex-col max-[900px]:items-stretch">
        <div className="flex flex-col gap-03">
          {TITLE}
          <p className="text-body-01 text-text-secondary">{data.intro}</p>
        </div>
        <div className="w-[280px] max-[900px]:w-full">
          <ProgressBar
            label="Sprint progress"
            value={data.done}
            max={data.of}
            valueText={data.count}
          />
        </div>
      </header>

      <ol
        aria-label="Weeks"
        className="grid grid-cols-4 gap-01 max-[900px]:grid-cols-1"
      >
        {data.weeks.map((week) => (
          <li
            key={week.name}
            aria-current={week.current ? "step" : undefined}
            className={clsx(
              "flex flex-col gap-05 border-t-2 p-05",
              week.tag ? "border-interactive" : "border-border-subtle",
              week.current ? "bg-highlight" : "bg-layer-01",
            )}
          >
            <div className="flex items-start justify-between gap-03">
              <div className="flex flex-col gap-02">
                <h2 className="text-heading-03">{week.name}</h2>
                <p
                  className={clsx(
                    "text-label-01",
                    week.current ? "text-support-info" : "text-text-secondary",
                  )}
                >
                  {week.date}
                </p>
              </div>
              {week.tag ? (
                <Tag color={week.tag.kind}>{week.tag.label}</Tag>
              ) : null}
            </div>
            <ul className="flex flex-col">
              {week.activities.map((activity) => (
                <ActivityRow key={activity.label} activity={activity} />
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-2 items-start gap-07 max-[900px]:grid-cols-1">
        {data.next ? (
          <section
            aria-labelledby="next-session"
            className="flex flex-col bg-layer-01"
          >
            <div className="flex flex-col gap-03 p-05">
              <h2
                id="next-session"
                className="text-label-01 text-text-secondary"
              >
                Next protected learning session
              </h2>
              <p className="text-display-03">{data.next.day}</p>
              <p className="text-body-02 text-text-secondary">
                {data.next.detail}
              </p>
            </div>
            <CalendarMenu
              hour={data.calendar}
              trigger={
                <Button icon={CalendarAdd} className="w-full justify-between">
                  Add to calendar
                </Button>
              }
            />
          </section>
        ) : null}
        <InlineNotification title="This is work time.">
          You are not expected to learn after hours. This session is part of
          your working week. If a client deadline clashes, move it to another
          slot that week.
        </InlineNotification>
      </div>
    </div>
  );
}
