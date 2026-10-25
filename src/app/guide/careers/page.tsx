import { ArrowRight } from "@carbon/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { GuideTable } from "../_components/GuideTable";
import { CareerControls, StartAs } from "../_components/TrackDemo";

export const metadata: Metadata = {
  title: "Change careers guide · From Zero to Hero",
};

const PARTNER = "footscray-library";

type Step = {
  stage: string;
  code: string;
  title: string;
  detail: string;
  href: string;
  merged?: boolean;
};

/** Main.png's ten screens, each linked to its route (spec 5.3). */
const STEPS: Step[] = [
  {
    stage: "Awareness",
    code: "1",
    title: "Discover",
    detail: "Entry from a partner touchpoint",
    href: `/p/${PARTNER}`,
  },
  {
    stage: "Evaluation",
    code: "2",
    title: "Tell us about you",
    detail: "Role, target, hours, consent",
    href: `/careers/map/new?partner=${PARTNER}`,
  },
  {
    stage: "Evaluation",
    code: "3",
    title: "Your Pivot Map",
    detail: "Strengths first, then 3 skills",
    href: "/careers/map",
  },
  {
    stage: "Sign-up (free)",
    code: "3b",
    title: "Save your map",
    detail: "Free account, personal email only",
    href: "/signup?track=career",
    merged: true,
  },
  {
    stage: "Sign-up (free)",
    code: "4",
    title: "Join a crew",
    detail: "Guide, peers and a Crew Agreement you can edit",
    href: "/careers/crew/join",
    merged: true,
  },
  {
    stage: "Sign-up (free)",
    code: "4b",
    title: "Protect your hours",
    detail: "Pick learning days, hold the time",
    href: "/careers/crew/hours",
    merged: true,
  },
  {
    stage: "Delivery",
    code: "5",
    title: "Learn this week",
    detail: "15-minute lessons and a project",
    href: "/careers/week",
  },
  {
    stage: "Delivery",
    code: "5b",
    title: "Crew demo day",
    detail: "Show the project, write the reflection",
    href: "/careers/crew/demo-day",
    merged: true,
  },
  {
    stage: "Delivery",
    code: "6",
    title: "Prove it",
    detail: "Badge, project, reflection, endorsement",
    href: "/careers/proof",
    merged: true,
  },
  {
    stage: "After-sales",
    code: "7",
    title: "Keep going",
    detail: "Re-entry and the next crew",
    href: "/careers/journey",
  },
];

const KEPT = [
  [
    "Sign up and log in (login-02 layout)",
    "02a, 02b",
    "Save your map after the map, not before it; log in lands on Keep going",
    "3b, log in, desktop",
  ],
  [
    "Collapsible, draggable sidebar with account menu",
    "08 to 19",
    "Desktop shell for the map, the week, proof and settings",
    "All desktop",
  ],
  [
    "Team AI Agreement builder",
    "06, 10",
    "Crew Agreement drafted by the guide; tick, untick or propose a rule",
    "4",
  ],
  [
    "Protected-hour picker and 4-week preview",
    "04",
    "Learning days sized to the hours you chose, plus the crew check-in",
    "4b",
  ],
  [
    "Show and tell",
    "14",
    "Crew demo day with the same prompts: what worked, what failed",
    "5b",
  ],
  [
    "Badge plus applied reflection",
    "15",
    "Reflection becomes part of proof: badge, project, endorsement",
    "6, desktop proof",
  ],
  [
    "Settings and privacy tabs",
    "17, 19",
    "Profile, reminders and privacy, with no employer view at all",
    "Desktop settings",
  ],
];

const SCAMPER = [
  [
    "Combine",
    "Brigitte, Nhi and Catherine",
    "Merged three separate journeys into one",
    "Pivot Map (Brigitte), then time-fit learning (Nhi), then crew and show and tell (Catherine)",
  ],
  [
    "Substitute",
    "Catherine's manager-first prototype",
    "Replaced the manager as leader with a Pathway Guide who already works in the target career",
    "Guidance from the new field, without involving the current employer",
  ],
  [
    "Adapt",
    "Catherine's Team AI Agreement",
    "Rewrote it for peers instead of a workplace team",
    "Crew Agreement: protect the hour, share one thing tried, use AI openly, no judgement",
  ],
  [
    "Modify (minify)",
    "Nhi's time-fit idea and Brigitte's short lessons",
    "Learning is sized to the hours the learner chooses, in lessons of about 15 minutes",
    "Learning fits around work and family",
  ],
  [
    "Put to another use",
    "Brigitte's credential screen and Catherine's badge reflection",
    "The badge becomes proof, not just a completion record",
    "Badge, job-style project and guide endorsement, shared on LinkedIn",
  ],
  [
    "Eliminate",
    "Brigitte's privacy promise",
    "Removed all employer visibility",
    "Private by design: the employer never sees the map or progress",
  ],
  [
    "Reverse",
    "Brigitte's “You already have” panel",
    "Strengths before gaps",
    "The Pivot Map opens with transferable skills, then a gap capped at 3",
  ],
  [
    "New in A3",
    "Whole group",
    "Added what none of the A2 prototypes had",
    "A crew of 5 to 6 changers heading the same way, plus one-tap “pick up where you left off”",
  ],
];

const WRAPS = [
  {
    title: "A clear path",
    text: "Strengths first, 3 skills, 3 free credentials.",
  },
  { title: "Time that fits", text: "Self-set hours and 15-minute lessons." },
  {
    title: "People who keep you going",
    text: "A Pathway Guide and a crew of 5 to 6.",
  },
];

/** Main (careers): the Change careers guide, its walkthrough and the careers controls. */
export default function CareersGuidePage() {
  return (
    <>
      <section className="grid items-start gap-09 min-[1056px]:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-06">
          <h1 className="max-w-[20ch] text-display-03 font-light text-balance md:text-display-02">
            Your next career, mapped and backed.
          </h1>
          <p className="max-w-[65ch] text-body-01 text-text-secondary">
            A free IBM SkillsBuild pathway that shows career changers aged 25 to
            40 which digital skills their new career needs, fits the learning
            into the time they have, and keeps them going with a guide and a
            crew until they finish with proof employers can see.
          </p>
        </div>
        <div className="flex flex-col gap-03">
          <ButtonLink href={`/p/${PARTNER}`} icon={ArrowRight} prefetch={false}>
            Start the walkthrough
          </ButtonLink>
          <StartAs who="amara" to="/careers/journey" arrow>
            Start as Amara
          </StartAs>
          <ButtonLink href="/guide/blueprint" kind="tertiary" icon={ArrowRight}>
            Open blueprint
          </ButtonLink>
        </div>
      </section>

      <div className="flex flex-col gap-02 border-l-[3px] border-support-info bg-highlight p-05">
        <span className="text-label-01 text-text-secondary">How might we</span>
        <p className="text-heading-03">
          give career changers aged 25 to 40 a clear, career-relevant learning
          path and ongoing support, so that they complete their SkillsBuild
          credentials and feel confident moving into a new career?
        </p>
      </div>

      <section aria-labelledby="walkthrough" className="flex flex-col gap-05">
        <div className="flex flex-wrap items-end justify-between gap-05">
          <h2 id="walkthrough" className="text-heading-03">
            Walkthrough: ten screens, five journey stages
          </h2>
          <p className="text-label-01 text-text-secondary">
            Persona: Amara Okoye, 34, Retail Store Manager in Footscray, heading
            to Data Analyst
          </p>
        </div>
        <ol className="grid gap-01 min-[672px]:grid-cols-2 min-[1056px]:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.code} className="flex">
              <Link
                href={s.href}
                prefetch={false}
                className="flex w-full flex-col items-start gap-02 border-t-[3px] border-interactive bg-layer-01 p-05 pb-06 text-text-primary transition-colors duration-[70ms] ease-productive hover:bg-layer-hover"
              >
                <span className="text-label-01 text-text-secondary">
                  {s.stage}
                </span>
                <span className="text-display-03 font-light">{s.code}</span>
                <span className="text-body-02 font-semibold">{s.title}</span>
                <span className="text-label-01 text-text-secondary">
                  {s.detail}
                </span>
                {s.merged && <Tag>From manager-first</Tag>}
              </Link>
            </li>
          ))}
        </ol>
        <p className="text-label-01 text-text-secondary">
          Screens 1 to 7 follow the low-fidelity prototype. 3b, 4b and 5b were
          added when we merged in the manager-first prototype. Screens before 3b
          work signed out; the rest open as Amara.
        </p>
      </section>

      <section aria-labelledby="kept" className="flex flex-col gap-05">
        <h2 id="kept" className="text-heading-03">
          What we kept from the manager-first prototype
        </h2>
        <GuideTable
          label="What we kept from the manager-first prototype"
          head={[
            "Manager-first piece",
            "Old screens",
            "How it works in Change careers",
            "Now on",
          ]}
          rows={KEPT}
        />
        <p className="text-label-01 text-text-secondary">
          The manager pathway, manager dashboard and outcomes, the work project
          brief and the business partner email stay in Grow in my role: Change
          careers has no employer view.
        </p>
      </section>

      <div className="grid gap-09 min-[1056px]:grid-cols-[2fr_1fr]">
        <section
          aria-labelledby="scamper"
          className="flex min-w-0 flex-col gap-05"
        >
          <h2 id="scamper" className="text-heading-03">
            How we got here: SCAMPER on our A2 ideas
          </h2>
          <GuideTable
            label="SCAMPER on our A2 ideas"
            head={["Lever", "Taken from", "What we changed", "Result"]}
            rows={SCAMPER}
          />
          <p className="text-label-01 text-text-secondary">
            Eberle 1971; mash-up technique, Laverty and Littel 2020.
          </p>
        </section>
        <section
          aria-labelledby="wraps"
          className="flex min-w-0 flex-col gap-05"
        >
          <h2 id="wraps" className="text-heading-03">
            What it wraps around IBM&apos;s free content
          </h2>
          <div className="flex flex-col gap-03">
            {WRAPS.map((w) => (
              <div
                key={w.title}
                className="flex flex-col gap-02 bg-layer-01 p-05"
              >
                <h3 className="text-heading-04">{w.title}</h3>
                <p className="text-body-02 text-text-secondary">{w.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <CareerControls />

      <p className="text-label-01 text-text-secondary">
        Concept prototype. Not an official IBM product. Example roles, job-ad
        text and credential names are illustrative.
      </p>
    </>
  );
}
