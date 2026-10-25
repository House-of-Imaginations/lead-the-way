"use client";

import { ArrowRight } from "@carbon/icons-react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import {
  CAREER_TARGETS,
  type ClockTarget,
} from "@convex/lib/demo/careerSchedule";
import { DEMO_TIME_ZONE } from "@convex/lib/demo/schedule";
import { hourLabel, hourLong } from "@convex/lib/sprintTime";
import {
  Button,
  type ButtonKind,
  InlineNotification,
  Modal,
  Select,
  StatTile,
} from "@/components/ui";
import { switchPersona } from "@/lib/demo/switchPersona";

/** The cast's addresses (`convex/lib/demo/cast.ts`), as in `GuideDemo`. */
const EMAIL = {
  priya: "priya.raman@calderlane.com.au",
  dan: "dan.okafor@calderlane.com.au",
  amara: "amara@pivotcrews.example",
} as const;
type Who = keyof typeof EMAIL;

// ponytail: one switch at a time across every button on the page. A switch
// that works navigates away, so only a failure clears it.
let switching = false;

function ErrorLine({ children }: { children: string }) {
  return (
    <p role="alert" className="text-label-01 text-support-error">
      {children}
    </p>
  );
}

/**
 * Sign in as a demo persona and open `to`. Dan is got ready first
 * (`demo.prepareDan`): seated at week 1, and with `privateTrack`, holding a
 * private Change careers track beside his team sprint.
 */
export function StartAs({
  who,
  to,
  privateTrack = false,
  kind = "tertiary",
  arrow = false,
  children,
}: {
  who: Who;
  to: string;
  privateTrack?: boolean;
  kind?: ButtonKind;
  /** An arrow icon, as the guides' hero links have (a server page can't pass the icon). */
  arrow?: boolean;
  children: string;
}) {
  const convex = useConvex();
  const prepareDan = useMutation(api.demo.prepareDan);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-stretch gap-02">
      <Button
        kind={kind}
        icon={arrow ? ArrowRight : undefined}
        disabled={busy}
        onClick={async () => {
          if (switching) return;
          switching = true;
          setBusy(true);
          setFailed(false);
          try {
            if (who === "dan") await prepareDan({ privateTrack });
            await switchPersona(convex, EMAIL[who], to);
          } catch {
            switching = false;
            setBusy(false);
            setFailed(true);
          }
        }}
      >
        {children}
      </Button>
      {failed && (
        <ErrorLine>
          Couldn&apos;t switch accounts. Reset the demo and try again.
        </ErrorLine>
      )}
    </div>
  );
}

/** Both tracks back to the start, from any demo account (`demo.resetAll`). */
function ResetDemo() {
  const resetAll = useMutation(api.demo.resetAll);
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Modal
      trigger={<Button kind="danger">Reset demo</Button>}
      onOpenChange={() => setFailed(false)}
      title="Reset the demo?"
      description="Calder Lane goes back to Tuesday 1 September at 9:30 AM and the careers demo to Monday 26 October at 9:00 AM. Everything added since is removed, including your changes."
      primaryText="Reset demo"
      primaryKind="danger"
      primaryDisabled={resetting}
      secondaryText="Cancel"
      onPrimary={async () => {
        setResetting(true);
        setFailed(false);
        try {
          await resetAll({});
          window.location.reload();
        } catch {
          setFailed(true);
          setResetting(false);
        }
      }}
    >
      {failed && (
        <ErrorLine>
          Couldn&apos;t reset the demo. Reload the page and try again.
        </ErrorLine>
      )}
    </Modal>
  );
}

/** Null while loading; a note without DEMO_MODE or a demo account. */
function DemoOnly({ children }: { children: ReactNode }) {
  const status = useQuery(api.demo.careerStatus, {});
  if (status === undefined) return null;
  if (status === null)
    return (
      <InlineNotification title="Demo accounts only.">
        These controls work when you are signed in as one of the demo accounts
        with demo mode on.
      </InlineNotification>
    );
  return children;
}

const SESSIONS: {
  title: string;
  detail: string;
  start: ReactNode;
}[] = [
  {
    title: "The team story",
    detail:
      "Priya sets up the sprint and Dan learns inside the protected hour, screens 01 to 16. The team guide has the walkthrough, the team clock and its counts.",
    start: (
      <StartAs who="priya" to="/guide/team">
        Start as Priya
      </StartAs>
    ),
  },
  {
    title: "Amara's careers story",
    detail:
      "Amara goes from Discover to Keep going. The careers guide has the walkthrough, the careers clock and its counts.",
    start: (
      <StartAs who="amara" to="/guide/careers">
        Start as Amara
      </StartAs>
    ),
  },
  {
    title: "Dan starts a private track",
    detail:
      "Dan, in Priya's sprint at week 1, starts a private Change careers track from his account menu, then sees both tracks on Home.",
    start: (
      <>
        <StartAs who="dan" to="/home">
          Start as Dan
        </StartAs>
        <StartAs who="dan" to="/home" privateTrack kind="ghost">
          Skip the form
        </StartAs>
      </>
    ),
  },
  {
    title: "Privacy by track",
    detail:
      "Dan, with a private track already started, sets what each track shares and can delete a track.",
    start: (
      <StartAs who="dan" to="/settings/privacy" privateTrack>
        Start as Dan
      </StartAs>
    ),
  },
];

/** M0's demo block: the researcher's four sessions, reset between them. */
export function ResearchSessions() {
  return (
    <section aria-labelledby="sessions" className="flex flex-col gap-07">
      <div className="flex flex-col gap-03">
        <h2 id="sessions" className="text-heading-01 font-light">
          Research sessions
        </h2>
        <p className="max-w-[65ch] text-body-02 text-text-secondary">
          Reset the demo between sessions. One reset puts both tracks back to
          the start, for everyone using the demo.
        </p>
      </div>
      <DemoOnly>
        <ol className="flex flex-col border-t border-border-inverse">
          {SESSIONS.map((s, i) => (
            <li
              key={s.title}
              className="grid gap-05 border-b border-border-subtle py-05 min-[672px]:grid-cols-[1fr_14rem]"
            >
              <div className="flex flex-col gap-02">
                <span className="text-label-01 text-text-secondary">
                  Session {i + 1}
                </span>
                <h3 className="text-heading-04">{s.title}</h3>
                <p className="max-w-[65ch] text-body-02 text-text-secondary">
                  {s.detail}
                </p>
              </div>
              <div className="flex flex-col gap-03">{s.start}</div>
            </li>
          ))}
        </ol>
        <div>
          <ResetDemo />
        </div>
      </DemoOnly>
    </section>
  );
}

const STAGES: Record<ClockTarget, string> = {
  week1: "Week 1",
  week2: "Week 2",
  week3: "Week 3, demo day",
  proof: "Proof",
};

const COUNT_LABELS: Record<string, string> = {
  mapBuilt: "Pivot Maps built",
  accountCreated: "Accounts created",
  privateTrackStarted: "Private tracks started",
  answersDeleted: "Answers deleted",
  trackDeleted: "Tracks deleted",
};

/** The careers guide's controls: the careers clock, a missed week, counts and reset. */
export function CareerControls() {
  return (
    <section aria-labelledby="career-controls" className="flex flex-col gap-07">
      <h2 id="career-controls" className="text-heading-01 font-light">
        Demo controls
      </h2>
      <DemoOnly>
        <CareerClock />
      </DemoOnly>
    </section>
  );
}

function CareerClock() {
  const status = useQuery(api.demo.careerStatus, {});
  const move = useMutation(api.demo.moveCareerClock);
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!status) return null;
  const { now, missedWeek } = status;
  const targets = (Object.keys(STAGES) as ClockTarget[]).filter(
    (t) => now !== null && CAREER_TARGETS[t] > now,
  );
  const counts = new Map(status.counts.map((c) => [c.name, c.count]));
  const names = [
    ...Object.keys(COUNT_LABELS),
    ...status.counts.map((c) => c.name).filter((n) => !(n in COUNT_LABELS)),
  ];

  async function run(target: ClockTarget | "missedWeek") {
    setMoving(true);
    setFailed(false);
    try {
      await move({ target });
    } catch {
      setFailed(true);
    }
    setMoving(false);
  }

  return (
    <div className="flex flex-col gap-07">
      <div className="flex flex-col gap-05">
        <div className="flex flex-col gap-02">
          <span className="text-label-01 text-text-secondary">
            Careers demo time
          </span>
          <span className="text-heading-03">
            {now === null
              ? "Not started. Reset the demo."
              : hourLong(now, DEMO_TIME_ZONE)}
          </span>
          {missedWeek && (
            <span className="text-body-02 text-text-secondary">
              Amara has missed a week, so Keep going shows the way back in.
            </span>
          )}
        </div>
        {targets.length > 0 ? (
          <form
            className="flex flex-wrap items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const target = new FormData(e.currentTarget).get("target");
              void run(target as ClockTarget);
            }}
          >
            <div className="w-full max-w-80">
              <Select
                id="career-target"
                name="target"
                label="Move the careers demo to"
                options={targets.map((t) => ({
                  value: t,
                  label: `${STAGES[t]}, ${hourLabel(CAREER_TARGETS[t], DEMO_TIME_ZONE)}`,
                }))}
              />
            </div>
            <Button type="submit" kind="secondary" size="md" disabled={moving}>
              Move clock
            </Button>
          </form>
        ) : (
          <p className="text-body-02">
            Amara has her proof. Reset the demo to start again.
          </p>
        )}
        <div className="flex flex-wrap gap-05">
          <Button
            kind="tertiary"
            disabled={moving || missedWeek}
            onClick={() => void run("missedWeek")}
          >
            Miss a week
          </Button>
          <ResetDemo />
        </div>
        {failed && (
          <ErrorLine>
            Couldn&apos;t move the clock. Reload the page and try again.
          </ErrorLine>
        )}
      </div>

      <div className="flex flex-col gap-05">
        <div className="flex flex-col gap-02">
          <h3 className="text-heading-03">What happened in the careers demo</h3>
          <p className="text-body-02 text-text-secondary">
            Totals since the last reset, from every account. No names.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-01 min-[672px]:grid-cols-3 min-[1056px]:grid-cols-5">
          {names.map((name) => (
            <StatTile
              key={name}
              label={COUNT_LABELS[name] ?? name}
              value={String(counts.get(name) ?? 0)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-03">
        <h3 className="text-heading-04">Good to know</h3>
        <ul className="max-w-[65ch] list-disc pl-05 text-body-02">
          <li>
            The careers clock runs after the team sprint closes, so Dan&apos;s
            Home shows September team dates beside November careers dates.
          </li>
          <li>The clock only moves forward. Reset the demo to go back.</li>
        </ul>
      </div>
    </div>
  );
}
