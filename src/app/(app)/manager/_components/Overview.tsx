"use client";

import {
  Add,
  ArrowRight,
  CheckmarkOutline,
  Locked,
  RadioButton,
  RadioButtonChecked,
} from "@carbon/icons-react";
import clsx from "clsx";
import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import {
  Button,
  ButtonLink,
  Disclosure,
  InlineNotification,
  ProgressBar,
  StatTile,
  Tag,
  useToast,
} from "@/components/ui";
import { RESOURCES } from "@/content/resources";
import { RunAnother } from "./RunAnother";

type Data = NonNullable<FunctionReturnType<typeof api.manager.overview>>;
type Column = Data["timeline"][number];
type Stat = NonNullable<Data["sprint"]["projects"]>;

/** A team total as one word or number. Every label around it comes from Convex. */
function statValue(stat: Stat): string {
  return stat.kind === "shown"
    ? String(stat.value)
    : stat.kind === "hidden"
      ? "Hidden"
      : "Not yet";
}

/** One stat tile. Shown: "6 of 7" with a bar. Hidden or pending: the word and why. */
function TeamStat({ label, stat }: { label: string; stat: Stat }) {
  if (stat.kind !== "shown")
    return (
      <StatTile label={label} value={statValue(stat)} helper={stat.helper} />
    );
  return (
    <StatTile label={label} value={String(stat.value)} suffix={`of ${stat.of}`}>
      <div className="pt-04">
        <ProgressBar
          label={label}
          value={stat.value}
          max={stat.of}
          valueText={`${stat.value} of ${stat.of}`}
          hideLabel
        />
      </div>
    </StatTile>
  );
}

/** One column of the sprint timeline: a 2px rule, its label and its items. */
function TimelineColumn({ column }: { column: Column }) {
  const current = column.state === "current";
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={clsx(
        "flex flex-col gap-04 border-t-2 p-05",
        column.state === "todo" ? "border-border-subtle" : "border-interactive",
        current && "bg-highlight",
      )}
    >
      <p
        className={clsx(
          "text-label-01",
          current ? "text-support-info" : "text-text-secondary",
        )}
      >
        {column.label}
      </p>
      <ul className="flex flex-col gap-03">
        {column.items.map((item) => {
          const Icon = item.done
            ? CheckmarkOutline
            : current
              ? RadioButtonChecked
              : RadioButton;
          return (
            <li
              key={item.label}
              className={clsx(
                "flex items-start gap-03 text-body-02",
                current && !item.done && "font-semibold",
                column.state === "todo" && "text-text-secondary",
              )}
            >
              <Icon
                size={16}
                aria-hidden="true"
                className={clsx(
                  "mt-01 shrink-0",
                  item.done || current
                    ? "text-interactive"
                    : "text-text-secondary",
                )}
              />
              <span>
                {item.done && <span className="sr-only">Done: </span>}
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/**
 * A summary card: label, title, optional tag, body, and a full-width link row.
 * Without `linked` (no sprint:manage) the row would only bounce back here.
 */
function Card({
  id,
  label,
  title,
  tag,
  href,
  action,
  linked,
  children,
}: {
  id: string;
  label: string;
  title: string;
  tag?: Data["sprint"]["tag"];
  href: string;
  action: string;
  linked: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col border border-border-subtle"
    >
      <div className="flex flex-1 flex-col gap-05 p-05">
        <div className="flex items-start justify-between gap-05">
          <div className="flex flex-col gap-02">
            <h2 id={id} className="text-label-01 text-text-secondary">
              {label}
            </h2>
            <p className="text-heading-04">{title}</p>
          </div>
          {tag ? <Tag color={tag.kind}>{tag.label}</Tag> : null}
        </div>
        {children}
      </div>
      {linked ? (
        <div className="border-t border-border-subtle">
          <ButtonLink
            href={href}
            kind="ghost"
            icon={ArrowRight}
            className="w-full justify-between"
          >
            {action}
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );
}

const SIMULATED = "Simulated in this prototype.";

/**
 * Spec 3.3: the nav's Resources (/manager#resources) lands here with focus:
 * on mount (a full load, or a client navigation from another page), and on
 * a hash-only change. Next's <Link> makes that change with pushState, which
 * fires no hashchange, so we listen to the Navigation API's entry change.
 * Next pushes inside React's commit, and React then puts focus back on the
 * clicked link, so that focus waits for the commit to end.
 */
function Resources() {
  const toast = useToast();
  useEffect(() => {
    const focus = () => {
      if (window.location.hash === "#resources")
        document.getElementById("resources")?.focus();
    };
    const afterCommit = () => setTimeout(focus);
    focus();
    // ponytail: without the Navigation API (older browsers), a hash-only
    // click still scrolls here, just without focus.
    const navigation = (window as { navigation?: EventTarget }).navigation;
    navigation?.addEventListener("currententrychange", afterCommit);
    window.addEventListener("hashchange", focus);
    return () => {
      navigation?.removeEventListener("currententrychange", afterCommit);
      window.removeEventListener("hashchange", focus);
    };
  }, []);
  return (
    <section
      id="resources"
      tabIndex={-1}
      aria-labelledby="resources-title"
      className="flex scroll-mt-07 flex-col gap-05 focus:outline-none"
    >
      <h2 id="resources-title" className="text-heading-03">
        Resources
      </h2>
      <ul className="border-t border-border-subtle">
        {RESOURCES.map((r) => (
          <li
            key={r.title}
            className="flex items-center justify-between gap-05 border-b border-border-subtle py-03 pl-05"
          >
            <div className="flex min-w-0 flex-col gap-02">
              <p className="text-body-02">{r.title}</p>
              <p className="text-label-01 text-text-secondary">
                {r.description}
              </p>
            </div>
            <Button kind="ghost" onClick={() => toast({ title: SIMULATED })}>
              {r.action}
              <span className="sr-only"> {r.title}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Overview({
  preloaded,
  greeting,
}: {
  preloaded: Preloaded<typeof api.manager.overview>;
  greeting: string;
}) {
  const data = usePreloadedQuery(preloaded);
  // No team or sprint yet (a fresh workspace before its first setup save).
  if (data === null) {
    return (
      <div className="flex flex-col gap-07">
        <h1 className="text-heading-01">{greeting}</h1>
        <InlineNotification>
          Your team&apos;s totals appear here after you launch the sprint.
        </InlineNotification>
        <Resources />
      </div>
    );
  }
  const { sprint, team } = data;
  const facts: [string, string][] = [
    ["Invited", String(sprint.invited)],
    ["Joined", String(sprint.joined)],
  ];
  if (sprint.projects) facts.push(["Projects", statValue(sprint.projects)]);

  return (
    <div className="flex flex-col gap-07">
      <header className="flex items-start justify-between gap-07 max-[900px]:flex-col">
        <div className="flex max-w-[720px] flex-col gap-03">
          <h1 className="text-heading-01">{greeting}</h1>
          <p className="text-body-01 text-text-secondary">{data.intro}</p>
        </div>
        {data.canManage ? (
          <div className="flex shrink-0 flex-wrap max-[672px]:w-full max-[672px]:flex-col">
            <ButtonLink
              href="/join/preview"
              kind="tertiary"
              className="max-[672px]:w-full"
            >
              Preview team view
            </ButtonLink>
            {/* R-d: once the sprint has closed, the next one is the next step. */}
            {data.canRunAnother ? (
              <RunAnother size="lg" />
            ) : (
              <ButtonLink
                href="/manager/sprint/launch"
                icon={Add}
                className="max-[672px]:w-full"
              >
                Invite member
              </ButtonLink>
            )}
          </div>
        ) : null}
      </header>

      <InlineNotification icon={Locked} title="Aggregate progress only.">
        Individual course activity remains private.
      </InlineNotification>

      <section aria-labelledby="sprint-title" className="flex flex-col gap-05">
        <h2 id="sprint-title" className="text-heading-03">
          Your four-week AI sprint
        </h2>
        <ol
          aria-labelledby="sprint-title"
          className="grid grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] gap-01 max-[900px]:grid-cols-1"
        >
          {data.timeline.map((column) => (
            <TimelineColumn key={column.label} column={column} />
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-3 gap-05 max-[900px]:grid-cols-1">
        <Card
          id="card-learning"
          label="Your learning"
          title={data.learning.title}
          href="/manager/learning"
          action="Continue pathway"
          linked={data.canManage}
        >
          <ProgressBar
            label={data.learning.label}
            value={data.learning.percent}
            max={100}
          />
        </Card>
        <Card
          id="card-sprint"
          label="Team sprint"
          title={sprint.title}
          tag={sprint.tag}
          href="/manager/sprint/launch"
          action="View sprint"
          linked={data.canManage}
        >
          <dl className="grid grid-cols-3 gap-05">
            {facts.map(([term, value]) => (
              <div key={term} className="flex flex-col gap-02">
                <dt className="text-label-01 text-text-secondary">{term}</dt>
                <dd className="text-heading-02 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card
          id="card-agreement"
          label="Team AI Agreement"
          title={data.agreement.title}
          tag={data.agreement.tag}
          href="/manager/agreement"
          action="Review agreement"
          linked={data.canManage}
        >
          {data.agreement.body ? (
            <p className="text-body-02">{data.agreement.body}</p>
          ) : null}
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start gap-07 max-[900px]:grid-cols-1">
        <section
          aria-labelledby="team-progress-title"
          className="flex flex-col gap-05"
        >
          <div className="flex items-baseline justify-between gap-05">
            <h2 id="team-progress-title" className="text-heading-03">
              Team progress
            </h2>
            {team ? (
              <p className="text-label-01 text-text-secondary">
                Team totals, updated weekly
              </p>
            ) : null}
          </div>
          {data.phase === "draft" ? (
            <InlineNotification>
              Your team&apos;s totals appear here after you launch the sprint.
            </InlineNotification>
          ) : team === null ? (
            <InlineNotification>
              Team totals need the team insights permission.
            </InlineNotification>
          ) : (
            <ul
              aria-labelledby="team-progress-title"
              className="grid grid-cols-3 gap-01 max-[672px]:grid-cols-1"
            >
              <li className="grid">
                <TeamStat
                  label="Joined the sprint"
                  stat={{
                    kind: "shown",
                    value: sprint.joined,
                    of: sprint.invited,
                  }}
                />
              </li>
              <li className="grid">
                <TeamStat {...team.sessionDone} />
              </li>
              <li className="grid">
                <TeamStat {...team.tasksUnderway} />
              </li>
            </ul>
          )}
          <Disclosure summary="Why can't I see individual progress?">
            Lead the Way shows you team totals only. Individual course activity,
            time spent and scores stay private to each person, so learning feels
            safe. Projects appear only when their owner chooses to present them.
          </Disclosure>
        </section>
        <Resources />
      </div>
    </div>
  );
}
