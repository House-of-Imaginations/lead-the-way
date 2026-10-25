import type { Metadata } from "next";
import { GuideTable } from "../_components/GuideTable";

export const metadata: Metadata = {
  title: "Experience map · From Zero to Hero",
};

const PHASES = [
  "Awareness",
  "Evaluation",
  "Sign-up (free)",
  "Delivery",
  "After-sales",
];

/** Above the line of visibility: what the career changer sees. */
const FRONT: [string, string[], boolean?][] = [
  ["Screens", ["1", "2, 3", "3b, 4, 4b", "5, 5b, 6", "7, log in"]],
  [
    "User step",
    [
      "Discover",
      "Tell us about you, then the Pivot Map",
      "Save the map, join a crew, protect your hours",
      "Learn weekly, demo day, then proof",
      "Keep going, next credential",
    ],
  ],
  [
    "Front stage touchpoint",
    [
      "Partner event QR, LinkedIn, library or TAFE",
      "Mobile web form",
      "Account, crew booking, calendar hold",
      "Mobile lessons; crew video call",
      "Notification and email; LinkedIn",
    ],
  ],
  [
    "User input",
    [
      "None",
      "Role, target career, hours a week, consent",
      "Account, Crew Agreement, learning days",
      "Lessons and project steps",
      "Return after a break",
    ],
  ],
  [
    "System response",
    [
      "Landing page: “Free”",
      "Builds the map: strengths, 3 skills, 3 credentials, weeks needed",
      "Matches a crew and a guide in the same field",
      "Progress bar; guide feedback",
      "“Pick up where you left off”; next crew offer",
    ],
  ],
  [
    "Pain point",
    [
      "“Is this for me? What does it cost?”",
      "“What skills do I even need?”",
      "“I'll be doing this alone.”",
      "“No time.” “Losing motivation.”",
      "“I fell behind, so I'll quit.”",
    ],
    true,
  ],
];

/** The emotion curve, low (0) to high (100), one point per phase. */
const EMOTION = [
  { label: "Curious, unsure", level: 20 },
  { label: "Clearer", level: 42 },
  { label: "Supported", level: 50 },
  { label: "Busy, then on track", level: 36 },
  { label: "Relieved, confident", level: 72 },
];

/** Below the line: what IBM and partners run. */
const BACK: [string, string[], boolean?][] = [
  [
    "Back stage (IBM and partners)",
    [
      "Partner co-hosted career events; partner-specific links for attribution",
      "Role-to-direction matching; job-ad skill list kept up to date",
      "Guide recruitment via employer partners and IBM volunteers; crew scheduling",
      "Curated SkillsBuild content; guide feedback; badge issuing",
      "Reminder triggers; crew cohort rotation; graduates recruited as guides",
    ],
  ],
  [
    "Expected outcome",
    [
      "Starts at no cost",
      "Knows exactly what to learn",
      "Accountability from day 1",
      "Steady weekly progress",
      "Completes and continues",
    ],
    true,
  ],
];

const PAINS = [
  [
    "Unclear which skills are needed",
    "JSA n.d.; PESTLE 2.1",
    "Pivot Map",
    "Role to direction to 3 skill gaps, with a job-ad example",
    "A clear, career-relevant path",
  ],
  [
    "No time: 44% name it as the main barrier",
    "ABS 2026",
    "Mobile lessons",
    "Self-set hours, micro-lessons of about 15 minutes",
    "Consistent weekly progress",
  ],
  [
    "Cost: 26% name it as the main barrier",
    "ABS 2026",
    "Landing page",
    "Free credentials, stated up front",
    "Removes the cost barrier",
  ],
  [
    "Motivation and self-regulation",
    "Kara et al. 2019",
    "Crew call, notifications",
    "Guide, crew and one-tap re-entry",
    "Higher engagement and completion",
  ],
  [
    "Doubt about recognition",
    "User insight 6.1B",
    "Demo day, LinkedIn",
    "Project, endorsement and badge together",
    "Confidence to apply",
  ],
];

const NABC = [
  ["Need", "A clear path and support to change careers."],
  ["Approach", "Pivot Map, plus a crew, plus micro-learning."],
  ["Benefit", "Completion and confidence."],
  [
    "Competition",
    "Self-paced platforms that offer access but no pathway or support.",
  ],
];

const cell = "border-b border-border-subtle px-05 py-04 align-top";
const rowHead = `${cell} bg-layer-01 text-left font-semibold`;

function Rows({ rows }: { rows: typeof FRONT }) {
  return rows.map(([name, cells, strong]) => (
    <tr key={name}>
      <th scope="row" className={rowHead}>
        {name}
      </th>
      {cells.map((text, i) => (
        <td key={i} className={`${cell} ${strong ? "font-semibold" : ""}`}>
          {text}
        </td>
      ))}
    </tr>
  ));
}

/** B1: the careers experience map and service blueprint. */
export default function BlueprintPage() {
  return (
    <>
      <section className="flex flex-col gap-06">
        <h1 className="text-heading-01 font-light text-balance md:text-display-03">
          Experience map and service blueprint
        </h1>
        <p className="max-w-[65ch] text-body-01 text-text-secondary">
          The five channel phases of the Business Model Canvas, with
          &ldquo;purchase&rdquo; as signing up because the service is free
          (Osterwalder and Pigneur 2010). What the career changer sees sits
          above the line of visibility; what IBM and partners run sits below it
          (Shostack 1984; Bitner, Ostrom and Morgan 2008).
        </p>
      </section>

      {/* Only a table scrolls sideways, inside its own container. */}
      <div
        role="region"
        aria-label="Service blueprint"
        tabIndex={0}
        className="overflow-x-auto"
      >
        <table className="w-full min-w-[960px] table-fixed text-left text-body-02">
          <colgroup>
            <col className="w-[13rem]" />
          </colgroup>
          <thead>
            <tr>
              <td className="border-b border-border-inverse" />
              {PHASES.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className="h-control-lg border-b border-border-inverse bg-layer-selected px-05 font-semibold"
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Rows rows={FRONT} />
            <tr>
              <th scope="row" className={rowHead}>
                Emotion
                <span className="block text-label-01 font-normal text-text-secondary">
                  Low to high
                </span>
              </th>
              <td colSpan={5} className={`${cell} p-0`}>
                <EmotionCurve />
              </td>
            </tr>
            <tr>
              <td
                colSpan={6}
                className="border-t-2 border-dashed border-border-inverse px-0 pt-02 pb-04 text-label-01 text-text-secondary"
              >
                Line of visibility. Above: what the career changer sees. Below:
                what IBM and partners run.
              </td>
            </tr>
            <Rows rows={BACK} />
          </tbody>
        </table>
      </div>

      <div className="grid gap-09 min-[1056px]:grid-cols-[2fr_1fr]">
        <section
          aria-labelledby="pains"
          className="flex min-w-0 flex-col gap-05"
        >
          <h2 id="pains" className="text-heading-03">
            Pain points, touchpoints and features
          </h2>
          <GuideTable
            label="Pain points, touchpoints and features"
            head={[
              "Pain point (evidence)",
              "Touchpoint",
              "Solution feature",
              "Expected outcome",
            ]}
            rows={PAINS.map(([pain, source, touch, feature, outcome]) => [
              <span key="p" className="flex flex-col font-normal">
                {pain}
                <span className="text-label-01 text-text-secondary">
                  {source}
                </span>
              </span>,
              touch,
              feature,
              <b key="o" className="font-semibold">
                {outcome}
              </b>,
            ])}
          />
        </section>
        <section
          aria-labelledby="nabc"
          className="flex min-w-0 flex-col gap-05"
        >
          <h2 id="nabc" className="text-heading-03">
            Value proposition (NABC)
          </h2>
          <dl className="flex flex-col gap-01">
            {NABC.map(([term, text]) => (
              <div key={term} className="flex flex-col gap-02 bg-layer-01 p-05">
                <dt className="text-label-01 text-text-secondary">{term}</dt>
                <dd className="text-body-01">{text}</dd>
              </div>
            ))}
          </dl>
          <p className="text-label-01 text-text-secondary">
            Lewrick, Link and Leifer 2020.
          </p>
        </section>
      </div>

      <p className="text-label-01 text-text-secondary">
        Concept prototype. Not an official IBM product. ABS figures:
        Work-related training and adult learning, Australia, 2024 to 25 (ABS
        2026). Example roles, job-ad text and credential names are illustrative.
      </p>
    </>
  );
}

/** One point per phase, at the centre of its column; the labels are live text. */
function EmotionCurve() {
  const x = (i: number) => (i + 0.5) * 20;
  const y = (level: number) => 100 - level;
  return (
    <div className="relative h-32">
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-interactive"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          points={EMOTION.map((e, i) => `${x(i)},${y(e.level)}`).join(" ")}
        />
      </svg>
      <ol className="absolute inset-0">
        {EMOTION.map((e, i) => (
          <li
            key={e.label}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-02 pb-[5px]"
            style={{ left: `${x(i)}%`, top: `${y(e.level)}%` }}
          >
            <span className="text-label-01 whitespace-nowrap">{e.label}</span>
            <span className="absolute bottom-0 h-3 w-3 translate-y-1/2 rounded-round bg-interactive" />
          </li>
        ))}
      </ol>
    </div>
  );
}
