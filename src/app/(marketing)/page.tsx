import { ArrowRight, Checkmark, ViewOff } from "@carbon/icons-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { HowItWorks } from "./_components/HowItWorks";
import { LandingHeader } from "./_components/LandingHeader";
import { PROTOTYPE_HREF } from "./links";
import "./landing.css";

export const metadata: Metadata = {
  description:
    "A four-week sprint that protects one hour a week for your team to learn AI on real work. Concept prototype. Not an official IBM product.",
};

const FACTS = [
  ["4 weeks", "A short, finite sprint. Not another open-ended subscription."],
  [
    "1 hour",
    "Protected each week, inside paid work time, for everyone on the team.",
  ],
  [
    "1 real task",
    "Each person applies what they learn to work they already do.",
  ],
  [
    "Free",
    "Delivered by your business association on free IBM SkillsBuild courses.",
  ],
] as const;

const SEE = [
  "Invitations and joins",
  "Team completion, as a total",
  "Number of applied projects",
  "Team confidence, before and after",
];
const NEVER = [
  "Named completion percentages",
  "Time each person spent",
  "Quiz scores or private activity",
  "Rankings of any kind",
];

const NUMBERS = [
  [8, "teammates invited, one shared weekly hour"],
  [7, "completed the sprint"],
  [6, "applied projects presented at show and tell"],
] as const;

// Spec 3.3: confidence 2.8 (14 over 5) to 4.0 (28 over 7); comfort 2.6 (13
// over 5) to 3.9 (27 over 7); 5 responses before and 7 after.
const QUESTIONS = [
  { title: "Confidence using AI at work", before: 2.8, after: 4.0 },
  { title: "Comfort discussing AI with my manager", before: 2.6, after: 3.9 },
];
const CAPTION =
  "Team average on a 1 to 5 scale, 5 responses before and 7 after";

const KIT = [
  [
    "Leading AI at Work",
    "60 min, for you",
    "The manager path you finish before your team starts.",
  ],
  [
    "Team AI Agreement",
    "30 min, with your team",
    "A one-page template with the four rules every team needs.",
  ],
  [
    "Inclusive facilitation guide",
    "Guide and checklist",
    "For part-time, CALD and neurodivergent staff, plus a Responsible AI checklist.",
  ],
  [
    "15-minute mentor call",
    "Optional",
    "With an IBM volunteer, through IBM Month of Impact.",
  ],
] as const;

/** Words as spans, rendered on the server, so motion can light them in reading order. */
function words(text: string): ReactNode[] {
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part, i) =>
      /^\s+$/.test(part) ? (
        part
      ) : (
        <span key={i} className="w">
          {part}
        </span>
      ),
    );
}

/** The before and after bar: its final length is in the HTML (motion only replays it). */
function Bar({ label, value }: { label: "Before" | "After"; value: number }) {
  return (
    <div className={label === "After" ? "bar after" : "bar"}>
      <span className="cap">{label}</span>
      <span className="t">
        <i
          data-v={value}
          style={{ transform: `scaleX(${(value / 5).toFixed(2)})` }}
        />
      </span>
      <b>{value.toFixed(1)}</b>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <LandingHeader />
      <main id="top">
        <section className="hero" aria-labelledby="hero-t">
          <div className="wrap hero-copy">
            <h1 id="hero-t" data-intro>
              Make AI learning part of the working week.
            </h1>
            <p className="hero-sub" data-intro>
              A four-week sprint that protects one hour a week for your team to
              learn AI on real work.
            </p>
            <div className="hero-ctas" data-intro>
              <Link className="btn btn-p" href="/signup" prefetch={false}>
                Start your sprint
                <ArrowRight className="i" aria-hidden="true" />
              </Link>
              <a className="btn btn-t" href="#how">
                See the steps
                <ArrowRight className="i" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="hero-stage">
            <div className="stairs" aria-hidden="true">
              <span className="st st-1" />
              <span className="st st-2" />
              <span className="st st-3" />
            </div>
            <div className="shot-wrap">
              <figure className="shot">
                <Image
                  src="/landing/dashboard.webp"
                  width={2400}
                  height={1667}
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width: 1344px) 100vw, 1280px"
                  alt="Manager dashboard for Priya Raman at Calder Lane: week 2 of the four-week sprint, 7 of 8 teammates joined, with aggregate progress only."
                />
              </figure>
            </div>
          </div>
          <dl className="wrap facts">
            {FACTS.map(([term, detail]) => (
              <div key={term} className="fact" data-rise>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="manifesto wrap" aria-label="Why Lead the Way">
          <p className="mf">
            {words(
              "Most teams want to use AI well. Few are given the time to learn it, so it happens after hours, alone, or not at all. Lead the Way gives your team ",
            )}
            <em>{words("one protected hour a week")}</em>
            {words(", a shared set of rules, and a real task to try it on.")}
          </p>
        </section>

        <section className="how" id="how" aria-labelledby="how-t">
          <div className="wrap">
            <div className="how-head">
              <h2 className="h2" id="how-t" data-rise>
                It starts with you, then the whole team.
              </h2>
              <p className="lead" data-rise>
                You set up the conditions once. Your team learns together
                instead of alone.
              </p>
            </div>
            <HowItWorks />
          </div>
        </section>

        <section className="privacy wrap" id="privacy" aria-labelledby="pv-t">
          <h2 className="h2" id="pv-t" data-rise>
            You see the team, never the individual.
          </h2>
          <p className="lead" data-rise>
            Participation is opt-in and never used for performance review.
          </p>
          <div className="bento">
            <article className="cell c-team" data-rise>
              <h3>What managers see</h3>
              <p>
                Team totals, updated daily. Enough to know the sprint is
                working.
              </p>
              <figure className="par-a">
                <Image
                  src="/landing/team-progress.webp"
                  width={1230}
                  height={350}
                  sizes="(max-width: 900px) 100vw, 720px"
                  alt="Team progress: 7 of 8 joined, 6 of 7 finished week 1, 5 of 7 real tasks underway."
                />
              </figure>
              <ul className="lst">
                {SEE.map((item) => (
                  <li key={item}>
                    <Checkmark className="i" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="cell c-dan" data-rise>
              <h3>Dan keeps his learning his own.</h3>
              <p>
                His progress, reflections and course activity stay private. He
                chooses what goes on his credential.
              </p>
              <div className="phones" aria-hidden="true">
                <Image
                  className="phone ph-1"
                  src="/landing/phone-dashboard.webp"
                  width={780}
                  height={1640}
                  sizes="(max-width: 900px) 52vw, 290px"
                  alt=""
                />
                <Image
                  className="phone ph-2"
                  src="/landing/phone-badge.webp"
                  width={780}
                  height={1640}
                  sizes="(max-width: 900px) 52vw, 290px"
                  alt=""
                />
              </div>
            </article>
            <article className="cell c-never" data-rise>
              <h3>What managers never see</h3>
              <ul className="lst">
                {NEVER.map((item) => (
                  <li key={item}>
                    <ViewOff className="i" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="outcomes wrap" id="results" aria-labelledby="oc-t">
          <h2 className="h2" id="oc-t" data-rise>
            Four weeks later, AI is part of how the team works.
          </h2>
          <p className="lead" data-rise>
            Example sprint: Calder Lane Client Services, 9 people, 9 to 30
            September 2026.
          </p>
          <div className="oc-grid">
            <div className="nums">
              {NUMBERS.map(([n, label]) => (
                <div key={label} className="num" data-rise>
                  <b data-count={n}>{n}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="chart" data-rise>
              <div className="legend">
                <span>
                  <i />
                  Before, 9 Sep
                </span>
                <span className="after">
                  <i />
                  After, 30 Sep
                </span>
              </div>
              {QUESTIONS.map((q, i) => (
                <div key={q.title} className="q">
                  <h3>{q.title}</h3>
                  <p className="cap">{CAPTION}</p>
                  <div className="bars">
                    <Bar label="Before" value={q.before} />
                    <Bar label="After" value={q.after} />
                  </div>
                  {i === QUESTIONS.length - 1 ? (
                    <div className="axis" aria-hidden="true">
                      <span />
                      <div>
                        <span>0</span>
                        <span>1</span>
                        <span>2</span>
                        <span>3</span>
                        <span>4</span>
                        <span>5</span>
                      </div>
                      <span />
                    </div>
                  ) : null}
                </div>
              ))}
              <figure className="quote">
                <span className="av" aria-hidden="true">
                  DO
                </span>
                <div>
                  <blockquote>
                    “My weekly client report used to take two hours. With a
                    reusable prompt and our team checks, it now takes about
                    eighty minutes.”
                  </blockquote>
                  <figcaption>
                    Dan Okafor, Senior Account Executive, Calder Lane
                  </figcaption>
                </div>
              </figure>
            </div>
          </div>
        </section>

        <section className="kit wrap" id="kit" aria-labelledby="kit-t">
          <h2 className="h2" id="kit-t" data-rise>
            Nothing to design or buy.
          </h2>
          <p className="lead" data-rise>
            The starter kit is curated from existing SkillsBuild content, ready
            on day one.
          </p>
          <div className="rows">
            {KIT.map(([title, when, about]) => (
              <div key={title} className="row" data-row>
                <h3>{title}</h3>
                <span className="cap">{when}</span>
                <p>{about}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta" aria-labelledby="cta-t">
          <div className="wrap cta-in">
            <h2 id="cta-t" data-rise>
              Start with one hour a week.
            </h2>
            <p data-rise>
              Finish the manager path first. Your team is invited only once the
              hour is agreed.
            </p>
            <Link className="btn" href="/signup" prefetch={false} data-rise>
              Start your sprint
              <ArrowRight className="i" aria-hidden="true" />
            </Link>
          </div>
          <span className="cta-st cs-1" aria-hidden="true" />
          <span className="cta-st cs-2" aria-hidden="true" />
          <span className="cta-st cs-3" aria-hidden="true" />
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div>
            <a className="brand" href="#top">
              <Logo />
              Lead the Way
            </a>
            <p className="fine">
              A Southbank Business Collective member program, delivered with IBM
              SkillsBuild. Concept prototype. Not an official IBM product. Names
              and figures are examples.
            </p>
          </div>
          <div>
            <h4>Program</h4>
            <ul>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#kit">Starter kit</a>
              </li>
              <li>
                <a href="#results">Results</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Trust</h4>
            <ul>
              <li>
                <a href="#privacy">Privacy</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Prototype</h4>
            <ul>
              <li>
                <Link href={PROTOTYPE_HREF} prefetch={false}>
                  Open the prototype
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
