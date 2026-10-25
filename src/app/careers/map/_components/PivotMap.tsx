"use client";

import {
  ArrowRight,
  Calendar,
  Certificate,
  Checkmark,
  ChevronRight,
  Locked,
  Map as MapIcon,
  UserMultiple,
} from "@carbon/icons-react";
import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { useState, useTransition } from "react";
import { CareersHeader } from "@/components/careers/CareersHeader";
import {
  ButtonLink,
  ContentSwitcher,
  InlineNotification,
  SideNav,
} from "@/components/ui";
import type { api } from "@convex/_generated/api";
import { weeksForHours, type Hours } from "@convex/lib/careers/catalog";
import { setMapHours } from "@/lib/careers/actions";
import { HOUR_OPTIONS } from "../hours";

type PivotMapData = NonNullable<
  FunctionReturnType<typeof api.careers.drafts.pivotMap>
>;

const SIGN_UP = "/signup?track=career";

function Dot({ n, now }: { n: number; now?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex size-[28px] shrink-0 items-center justify-center rounded-round bg-background text-label-01 font-semibold",
        now
          ? "border-2 border-interactive text-interactive"
          : "border border-border-strong text-text-secondary",
      )}
    >
      {n}
    </span>
  );
}

/** 3 (phone) and D3 (1440): one tree, laid out per width. */
export function PivotMap({ map }: { map: PivotMapData }) {
  const [skill, setSkill] = useState(0);
  const [hours, setHours] = useState<Hours>(map.hoursPerWeek);
  const [, startTransition] = useTransition();
  const weeks = weeksForHours(hours);
  const hoursText = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const why = map.skills[skill]!;

  const switcher = (
    <div className="ltw-cs-fill">
      <ContentSwitcher
        label="Hours a week"
        options={HOUR_OPTIONS}
        value={String(hours)}
        onChange={(v) => {
          const next = Number(v) as Hours;
          setHours(next);
          // A failed save keeps the local choice rather than the error page.
          startTransition(() => setMapHours(next).catch(() => {}));
        }}
      />
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background text-text-primary">
      <div className="hidden lg:flex">
        <SideNav
          brand="Pivot Crews"
          homeHref="/careers/map"
          org={{
            initials: "",
            name: map.target.name,
            team: `from ${map.currentRole}`,
          }}
          orgIcon={MapIcon}
          sections={[
            {
              title: "Your path",
              links: [
                {
                  label: "My map",
                  href: "/careers/map",
                  icon: MapIcon,
                  current: true,
                },
                { label: "This week", href: "/careers/week", icon: Calendar },
                {
                  label: "My crew",
                  href: "/careers/crew/join",
                  icon: UserMultiple,
                },
                { label: "Proof", href: "/careers/proof", icon: Certificate },
              ],
            },
            {
              title: "You",
              links: [
                {
                  label: "Privacy and settings",
                  href: "/settings",
                  icon: Locked,
                },
              ],
            },
          ]}
          status={{
            heading: null,
            progress: null,
            label: "Next crew check-in",
            value: "Once you join a crew",
            note: "Your employer never sees this plan",
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <CareersHeader title="Your Pivot Map" back="/careers/map/new" />
        </div>
        <main className="flex flex-1 flex-col gap-06 px-05 pt-06 pb-07 lg:gap-07 lg:px-[40px] lg:py-07">
          <div className="flex items-end justify-between gap-06">
            <div className="flex flex-col gap-03">
              <h1 className="text-heading-01 text-balance">Your Pivot Map</h1>
              <span className="ltw-tag ltw-tag-blue self-start">
                {map.currentRole}
                <ArrowRight size={12} aria-label="to" />
                {map.target.name}
              </span>
            </div>
            <ButtonLink
              href={SIGN_UP}
              icon={ArrowRight}
              className="hidden lg:inline-flex"
            >
              Save my map
            </ButtonLink>
          </div>

          <div className="grid gap-06 lg:grid-cols-[1fr_1.4fr_1.2fr] lg:gap-[40px]">
            <section className="flex flex-col gap-04 lg:gap-05">
              <div className="flex flex-col gap-03">
                <h2 className="text-heading-04 lg:text-heading-03">
                  You already have
                </h2>
                <p className="hidden text-body-02 text-text-secondary lg:block">
                  {map.note}.
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-x-05 gap-y-03 lg:grid-cols-1 lg:gap-0 lg:border-t lg:border-border-inverse">
                {map.strengths.map((s) => (
                  <li
                    key={s}
                    className="flex items-center gap-03 lg:border-b lg:border-border-subtle lg:py-04"
                  >
                    <Checkmark
                      className="ltw-i text-support-success"
                      aria-hidden="true"
                    />
                    {s}
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-04 lg:gap-05">
              <div className="flex items-baseline justify-between gap-05 lg:flex-col lg:items-start lg:gap-03">
                <h2 className="text-heading-04 lg:text-heading-03">
                  <span className="lg:hidden">Skills to build</span>
                  <span className="hidden lg:inline">
                    {map.skills.length} skills to build
                  </span>
                </h2>
                <p className="text-label-01 text-text-secondary lg:hidden">
                  Tap one to see why
                </p>
                <p className="hidden text-body-02 text-text-secondary lg:block">
                  Capped at three, chosen from job ads for your target role.
                </p>
              </div>
              <ul className="flex flex-col gap-01">
                {map.skills.map((s, i) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      aria-pressed={i === skill}
                      onClick={() => setSkill(i)}
                      className={clsx(
                        "flex w-full items-center gap-04 border bg-layer-01 px-05 py-[13px] text-left hover:bg-layer-hover",
                        i === skill
                          ? "border-border-inverse"
                          : "border-transparent",
                      )}
                    >
                      <Dot n={i + 1} />
                      <span className="flex-1">{s.name}</span>
                      <ChevronRight className="ltw-i" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <div aria-live="polite">
                <InlineNotification title={`Why ${why.name}?`}>
                  <span className="mt-02 block text-label-01 text-text-secondary">
                    Example job ad: {why.jobAd.title}, {why.jobAd.place}
                  </span>
                  <span className="mt-02 block">“{why.jobAd.quote}”</span>
                </InlineNotification>
              </div>
            </section>

            <section className="flex flex-col gap-05">
              <div className="flex flex-col gap-03">
                <h2 className="text-heading-04 lg:text-heading-03">
                  <span className="lg:hidden">
                    {map.skills.length} free credentials, about {weeks.total}{" "}
                    weeks
                  </span>
                  <span className="hidden lg:inline">
                    About {weeks.total} weeks
                  </span>
                </h2>
                <p className="hidden text-body-02 text-text-secondary lg:block">
                  At {hoursText} a week, in lessons of about 15 minutes.
                </p>
              </div>
              {/* Phone: three steps in a row, then the switcher. */}
              <ol className="relative grid grid-cols-3 lg:hidden">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[16.67%] top-[14px] h-px bg-border-strong"
                />
                {map.skills.map((s, i) => (
                  <li
                    key={s.credential.id}
                    className="relative flex flex-col items-center gap-02 text-center text-label-01"
                  >
                    <Dot n={i + 1} />
                    {s.credential.name}
                  </li>
                ))}
              </ol>
              {switcher}
              <ol className="hidden border-t border-border-inverse lg:block">
                {map.skills.map((s, i) => (
                  <li
                    key={s.credential.id}
                    className="flex items-center gap-04 border-b border-border-subtle py-05"
                  >
                    <Dot n={i + 1} now={i === 0} />
                    <span className="flex flex-col">
                      <span className="text-body-emphasis">
                        {s.credential.name}
                      </span>
                      <span className="text-label-01 text-text-secondary">
                        Free IBM SkillsBuild credential, {weeks.perCredential}{" "}
                        weeks
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-label-01 text-text-secondary lg:hidden">
                Weeks are worked out from the {hoursText} a week you chose.
              </p>
            </section>
          </div>

          <div className="mt-auto flex flex-col gap-02 text-label-01 text-text-secondary">
            <p>
              Example roles, job-ad text and credential names are illustrative.
            </p>
            <p className="text-text-helper lg:hidden">
              Concept prototype. Not an official IBM product.
            </p>
          </div>
        </main>
        <div className="ltw-cf lg:hidden">
          <ButtonLink href={SIGN_UP} icon={ArrowRight} className="w-full">
            Save my map
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
