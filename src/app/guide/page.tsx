import { ArrowRight } from "@carbon/icons-react";
import clsx from "clsx";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { GuideTable } from "./_components/GuideTable";
import { ResearchSessions, StartAs } from "./_components/TrackDemo";

export const metadata: Metadata = {
  title: "Prototype guide · From Zero to Hero",
};

type Screen = [code: string, title: string];
type Lane = {
  name: string;
  tag: "gray" | "purple" | "blue";
  shared?: boolean;
  screens: Screen[];
};

const JOURNEY: Lane[] = [
  {
    name: "Shared entry",
    tag: "gray",
    shared: true,
    screens: [
      ["Landing", "Two doors"],
      ["MS1", "Choose a track"],
      ["Log in", "Either track"],
    ],
  },
  {
    name: "Grow in my role",
    tag: "purple",
    screens: [
      ["01", "Partner email"],
      ["02a", "Sign up"],
      ["04", "Protected hour"],
      ["06", "Team agreement"],
      ["08", "Manager overview"],
      ["09", "Dan's invite"],
      ["11", "This week"],
      ["14", "Show and tell"],
      ["16", "Team outcomes"],
    ],
  },
  {
    name: "Change careers",
    tag: "blue",
    screens: [
      ["1", "Discover"],
      ["3", "Pivot Map"],
      ["3b", "Save your map"],
      ["4", "Join a crew"],
      ["4b", "Your hours"],
      ["5", "This week"],
      ["5b", "Demo day"],
      ["6", "Prove it"],
      ["7", "Keep going"],
    ],
  },
  {
    name: "Both tracks",
    tag: "gray",
    shared: true,
    screens: [
      ["MS2", "Home, two tracks"],
      ["MS3", "Start a private track"],
      ["MS4", "Privacy by track"],
    ],
  },
];

const TWO_TRACKS = [
  [
    "For",
    "People who want to grow where they are",
    "Career changers aged 25 to 40",
  ],
  [
    "Way in",
    "A manager, through a business partner",
    "A library, TAFE or career event link",
  ],
  [
    "Who backs you",
    "Your manager protects one hour a week",
    "A Pathway Guide and a crew of 5 to 6",
  ],
  ["Length", "A 4-week team sprint", "3 credentials, 6 to 18 weeks"],
  [
    "You finish with",
    "A badge plus an applied work project",
    "A badge, a project, a reflection and an endorsement",
  ],
  [
    "Privacy",
    "Manager sees team totals, hidden below 5",
    "No employer sees anything",
  ],
  ["Persona", "Priya (manager) and Dan (employee)", "Amara (career changer)"],
];

const PRIVACY = [
  {
    title: "Grow in my role",
    text: "The manager sees team totals only, hidden below 5 people. Never a named person's progress, time or answers.",
  },
  {
    title: "Change careers",
    text: "No employer view at all. An employee in a team sprint can start a private Change careers track (MS3), and the manager never knows it exists.",
    selected: true,
  },
  {
    title: "Shared rules",
    text: "Nothing moves between tracks unless the learner moves it. Partners see anonymous totals of 5 or more.",
  },
];

const CORE = [
  [
    "A plan",
    "05 Manager pathway, 03 Your team",
    "3 Pivot Map",
    "What to learn and why, in 3 parts at most",
  ],
  [
    "Who backs you",
    "Priya, the manager",
    "Lena, a Pathway Guide, and a crew",
    "A person who checks in every week",
  ],
  [
    "An agreement",
    "06 and 10 Team AI Agreement",
    "4 Crew Agreement",
    "Rules the group writes together and signs",
  ],
  [
    "Protected time",
    "04 Protected hour",
    "4b Protect your hours",
    "Time held in the calendar, chosen up front",
  ],
  [
    "Weekly learning",
    "11 This week, 12 Work project",
    "5 Learn this week",
    "15-minute lessons plus one real task",
  ],
  [
    "Show it",
    "14 Show and tell",
    "5b Crew demo day",
    "Present what changed, then reflect",
  ],
  [
    "Proof",
    "15 Badge and reflection",
    "6 Prove it",
    "Badge plus evidence you can share",
  ],
  [
    "Your settings",
    "19 Settings",
    "D8 Privacy and settings",
    "Joined in MS4 Privacy by track",
  ],
];

/** M0: the master guide over both tracks, and the researcher's four sessions. */
export default function MasterGuidePage() {
  return (
    <>
      <section className="grid items-start gap-09 min-[1056px]:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-06">
          <h1 className="max-w-[18ch] text-display-03 font-light text-balance md:text-display-02">
            Learn what&apos;s next, with people who back you.
          </h1>
          <p className="max-w-[60ch] text-body-01 text-text-secondary">
            One IBM SkillsBuild product with two tracks.{" "}
            <b className="font-semibold text-text-primary">Grow in my role</b>:
            a manager protects an hour a week for a 4-week team sprint.{" "}
            <b className="font-semibold text-text-primary">Change careers</b>: a
            private path with a Pathway Guide and a crew. Both run on the same
            core, and each keeps its own privacy rules.
          </p>
        </div>
        <div className="flex flex-col gap-03">
          <ButtonLink href="/start" icon={ArrowRight} prefetch={false}>
            Choose a track
          </ButtonLink>
          <StartAs who="dan" to="/home" privateTrack arrow>
            See both tracks
          </StartAs>
          <ButtonLink href="/guide/team" kind="tertiary" icon={ArrowRight}>
            Open team guide
          </ButtonLink>
          <ButtonLink href="/guide/careers" kind="tertiary" icon={ArrowRight}>
            Open careers guide
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="journey" className="flex flex-col gap-06">
        <h2 id="journey" className="text-heading-03">
          The master journey
        </h2>
        <div className="flex flex-col gap-05">
          {JOURNEY.map((lane) => (
            <div
              key={lane.name}
              className="grid gap-03 min-[1056px]:grid-cols-[11rem_1fr]"
            >
              <h3 className="text-heading-04">{lane.name}</h3>
              <ol className="grid grid-cols-2 gap-01 min-[672px]:grid-cols-3 min-[1056px]:grid-cols-9">
                {lane.screens.map(([code, title]) => (
                  <li
                    key={code}
                    className={clsx(
                      "flex min-h-20 flex-col items-start gap-03 p-04",
                      lane.shared
                        ? "border-t-[3px] border-interactive bg-highlight"
                        : "bg-layer-01",
                    )}
                  >
                    <Tag color={lane.tag}>{code}</Tag>
                    <span className="text-body-02 font-semibold">{title}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <p className="text-label-01 text-text-secondary">
          Blue-ruled cards are screens shared by both tracks. Each track guide
          walks through its own screens.
        </p>
      </section>

      <div className="grid gap-09 min-[1056px]:grid-cols-2">
        <section
          aria-labelledby="two-tracks"
          className="flex min-w-0 flex-col gap-05"
        >
          <h2 id="two-tracks" className="text-heading-03">
            Two tracks
          </h2>
          <GuideTable
            label="Two tracks"
            head={["", "Grow in my role", "Change careers"]}
            rows={TWO_TRACKS}
            minWidth={560}
          />
        </section>
        <section
          aria-labelledby="privacy"
          className="flex min-w-0 flex-col gap-05"
        >
          <h2 id="privacy" className="text-heading-03">
            Privacy, split by track
          </h2>
          <div className="flex flex-col gap-03">
            {PRIVACY.map((p) => (
              <div
                key={p.title}
                className={clsx(
                  "flex flex-col gap-02 p-05",
                  p.selected
                    ? "border border-border-inverse bg-background"
                    : "bg-layer-01",
                )}
              >
                <h3 className="text-heading-04">{p.title}</h3>
                <p className="text-body-02 text-text-secondary">{p.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section aria-labelledby="core" className="flex flex-col gap-05">
        <h2 id="core" className="text-heading-03">
          One core, two ways in
        </h2>
        <GuideTable
          label="One core, two ways in"
          head={[
            "Building block",
            "Grow in my role",
            "Change careers",
            "What it does in both",
          ]}
          rows={CORE}
        />
        <p className="text-label-01 text-text-secondary">
          The shared design system, side nav, sign up and log in pattern, and
          the held-hour mark are the same in both tracks.
        </p>
      </section>

      <ResearchSessions />

      <p className="text-label-01 text-text-secondary">
        Concept prototype. Not an official IBM product. Names, organisations and
        figures are examples.
      </p>
    </>
  );
}
