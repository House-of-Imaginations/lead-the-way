"use client";

import { Locked } from "@carbon/icons-react";
import clsx from "clsx";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { InviteTeamModal } from "@/components/app/InviteTeamModal";
import { InlineNotification, StatTile, Tag } from "@/components/ui";

type Data = NonNullable<FunctionReturnType<typeof api.manager.outcomes>>;
type Closed = Extract<Data, { state: "closed" }>;
type Stat = Closed["participation"]["completed"];

/** The 1 to 5 scale; a bar is value / 5 of its track. */
const SCALE = [1, 2, 3, 4, 5];

function statValue(stat: Stat): string {
  return stat.kind === "shown"
    ? String(stat.value)
    : stat.kind === "hidden"
      ? "Hidden"
      : "Not yet";
}

function Total({ label, stat }: { label: string; stat: Stat }) {
  return stat.kind === "shown" ? (
    <StatTile label={label} value={String(stat.value)} />
  ) : (
    <StatTile label={label} value={statValue(stat)} helper={stat.helper} />
  );
}

/** A track with the scale's dashed lines and, when shown, the average's bar. */
function Track({ stat, fill }: { stat: Stat; fill: string }) {
  return (
    <div className="relative h-05" aria-hidden="true">
      {SCALE.map((k) => (
        <span
          key={k}
          className="absolute inset-y-0 border-l border-dashed border-border-subtle"
          style={{ left: `${k * 20}%` }}
        />
      ))}
      {stat.kind === "shown" ? (
        <span
          className={clsx("absolute inset-y-0 left-0", fill)}
          style={{ width: `${(stat.value / 5) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/** One phase of one question: its label for screen readers, the bar, the value. */
function Bar({
  label,
  stat,
  after = false,
}: {
  label: string;
  stat: Stat;
  after?: boolean;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-x-04 gap-y-02">
      <span className="sr-only">{label}: </span>
      <Track stat={stat} fill={after ? "bg-chart-after" : "bg-chart-before"} />
      <span
        className={clsx(
          "text-right text-body-02 tabular-nums",
          after && "font-semibold",
        )}
      >
        {stat.kind === "shown" ? stat.value.toFixed(1) : statValue(stat)}
      </span>
      {stat.kind !== "shown" ? (
        <span className="col-span-2 text-label-01 text-text-secondary">
          {stat.helper}
        </span>
      ) : null}
    </li>
  );
}

function Header({
  title,
  link,
  children,
}: {
  title: string;
  link: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-05">
      <div className="flex max-w-[65ch] flex-col gap-03">
        <h1 className="text-heading-01 text-balance">{title}</h1>
        {children}
      </div>
      <InviteTeamModal link={link} />
    </header>
  );
}

/** 16, a sprint's outcomes: team totals only, from the row taken at close. */
export function Outcomes({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.manager.outcomes>;
}) {
  const data = usePreloadedQuery(preloaded);
  if (!data) {
    return (
      <div className="flex max-w-content-max flex-col gap-07">
        <h1 className="text-heading-01">Outcomes</h1>
        <InlineNotification>Outcomes appear after your first sprint.</InlineNotification>
      </div>
    );
  }
  if (data.state === "pending") {
    return (
      <div className="flex max-w-content-max flex-col gap-07">
        <Header title={data.title} link={data.inviteLink} />
        <InlineNotification>{data.helper}</InlineNotification>
      </div>
    );
  }
  return <ClosedOutcomes data={data} />;
}

function ClosedOutcomes({ data }: { data: Closed }) {
  const { participation, beforeAfter, projects } = data;
  const most = Math.max(1, ...projects.categories.map((c) => c.count));
  const presented = participation.presented;
  return (
    <div className="flex max-w-content-max flex-col gap-07">
      <Header title={data.title} link={data.inviteLink}>
        <div>
          <Tag color="green">{data.tag}</Tag>
        </div>
        <p className="text-body-01 text-text-secondary">{data.intro}</p>
      </Header>

      <section
        aria-labelledby="participation-title"
        className="flex flex-col gap-05"
      >
        <h2 id="participation-title" className="text-heading-03">
          Team participation
        </h2>
        <ul
          aria-labelledby="participation-title"
          className="grid grid-cols-3 gap-01 max-[672px]:grid-cols-1"
        >
          <li className="grid">
            <StatTile label="Invited" value={String(participation.invited)} />
          </li>
          <li className="grid">
            <Total label="Completed the sprint" stat={participation.completed} />
          </li>
          <li className="grid">
            <Total label="Applied projects presented" stat={presented} />
          </li>
        </ul>
      </section>

      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start gap-09 max-[900px]:grid-cols-1">
        <section
          aria-labelledby="before-after-title"
          className="flex flex-col gap-06"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-05">
            <h2 id="before-after-title" className="text-heading-03">
              Before and after
            </h2>
            <p className="text-label-01 text-text-secondary">
              {beforeAfter.caption}
            </p>
          </div>
          {/* Each row names its phase for screen readers; the legend is for eyes. */}
          <p
            aria-hidden="true"
            className="flex flex-wrap gap-05 text-label-01 text-text-secondary"
          >
            <span className="flex items-center gap-03">
              <span className="size-03 bg-chart-before" />
              {beforeAfter.beforeLabel}
            </span>
            <span className="flex items-center gap-03">
              <span className="size-03 bg-chart-after" />
              {beforeAfter.afterLabel}
            </span>
          </p>
          {beforeAfter.questions.map((q, i) => (
            <section
              key={q.title}
              aria-labelledby={`question-${i}`}
              className="flex flex-col gap-03"
            >
              <h3 id={`question-${i}`} className="text-heading-04">
                {q.title}
              </h3>
              {q.quote ? (
                <p className="text-body-02 text-text-secondary">
                  “{q.quote}”
                </p>
              ) : null}
              <ul className="flex flex-col gap-02">
                <Bar label={beforeAfter.beforeLabel} stat={q.before} />
                <Bar label={beforeAfter.afterLabel} stat={q.after} after />
              </ul>
            </section>
          ))}
          <div
            aria-hidden="true"
            className="grid grid-cols-[minmax(0,1fr)_48px] gap-x-04 text-label-01 text-text-secondary"
          >
            <div className="relative h-05">
              {SCALE.map((k) => (
                <span
                  key={k}
                  className="absolute -translate-x-1/2 tabular-nums"
                  style={{ left: `${k * 20}%` }}
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="projects-title"
          className="flex flex-col gap-05"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-05">
            <h2 id="projects-title" className="text-heading-03">
              Applied projects
            </h2>
            {projects.caption ? (
              <p className="text-label-01 text-text-secondary">
                {projects.caption}
              </p>
            ) : null}
          </div>
          {projects.categories.length > 0 ? (
            <ul
              aria-labelledby="projects-title"
              className="flex flex-col border-t border-border-subtle"
            >
              {projects.categories.map((c) => (
                <li
                  key={c.label}
                  className="grid grid-cols-[minmax(0,1fr)_120px_24px] items-center gap-05 border-b border-border-subtle py-04 text-body-02"
                >
                  <span>{c.label}</span>
                  <span className="h-03 bg-border-subtle" aria-hidden="true">
                    <span
                      className="block h-full bg-interactive"
                      style={{ width: `${(c.count / most) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          ) : presented.kind !== "shown" ? (
            <p className="text-body-02 text-text-secondary">{presented.helper}</p>
          ) : null}
          <InlineNotification
            icon={Locked}
            title="Individual course activity remains private."
          >
            These are team totals. No names, scores, rankings or time spent
            are shown.
          </InlineNotification>
          <Link
            href="/manager/agreement"
            className="text-body-02 text-link hover:text-link-hover hover:underline max-[672px]:inline-flex max-[672px]:min-h-control-lg max-[672px]:items-center"
          >
            Review the Team AI Agreement with your team
          </Link>
        </section>
      </div>
    </div>
  );
}
