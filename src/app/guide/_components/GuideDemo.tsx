"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import { createContext, use, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  DEMO_TARGETS,
  DEMO_TIME_ZONE,
  type DemoTarget,
} from "@convex/lib/demo/schedule";
import { hourLong } from "@convex/lib/sprintTime";
import type { EventType } from "@convex/tables/sprint";
import {
  Button,
  InlineNotification,
  Modal,
  PasswordInput,
  Select,
  StatTile,
} from "@/components/ui";
import { switchPersona } from "@/lib/demo/switchPersona";
import { forwardTargets } from "@/lib/demo/targets";
import { errorCode } from "@/lib/errors";
import type { Persona } from "./guideContent";

type Status = typeof api.demo.status._returnType;
type Demo = NonNullable<NonNullable<Status>["demo"]>;

/**
 * The cast's addresses (`convex/lib/demo/cast.ts`, G-b). The switch reads
 * these, not `status`: an unseated account has no accounts list, and a reset
 * takes Dan's seat away while the switch is still running.
 */
const EMAIL: Record<Persona, string> = {
  priya: "priya.raman@calderlane.com.au",
  dan: "dan.okafor@calderlane.com.au",
};

const COUNT_LABELS: Record<EventType, string> = {
  "hour.committed": "Hours committed",
  "hour.notReady": "Not ready, with a reason",
  "pathway.completed": "Pathways completed",
  "agreement.saved": "Agreements saved",
  "sprint.launched": "Sprints launched",
  "invite.accepted": "Invitations accepted",
  "agreement.signed": "Agreement signatures",
  "project.saved": "Projects saved",
  "project.presented": "Projects presented",
  "survey.answered": "Survey answers",
};

const Ctx = createContext<{
  status: Status | undefined;
  expectOrgId: Id<"orgs"> | null;
  startAs: (who: Persona, to: string) => Promise<void>;
} | null>(null);

export function useGuideDemo() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useGuideDemo needs GuideDemoProvider.");
  return ctx;
}

/**
 * The guide's one subscription to `demo.status` and the persona switch.
 * `expectOrgId` is the demo's id when the page was rendered for a demo seat
 * (`shell.isDemo`), else null.
 */
export function GuideDemoProvider({
  expectOrgId,
  children,
}: {
  expectOrgId: Id<"orgs"> | null;
  children: ReactNode;
}) {
  const convex = useConvex();
  const status = useQuery(api.demo.status, {});
  const setClock = useMutation(api.demo.setClock);

  async function startAs(who: Persona, to: string) {
    const demo = status?.demo;
    if (demo?.persona === who) {
      window.location.assign(to);
      return;
    }
    // G-e and R4: Dan has a seat from 8 September, so jump to week 1 first.
    if (
      who === "dan" &&
      demo &&
      expectOrgId &&
      demo.demoNow < DEMO_TARGETS.week1
    ) {
      try {
        await setClock({ target: "week1", expectOrgId });
      } catch (e) {
        if (errorCode(e) !== "DEMO_CLOCK_BACKWARDS") throw e;
      }
    }
    await switchPersona(convex, EMAIL[who], to);
  }

  return <Ctx value={{ status, expectOrgId, startAs }}>{children}</Ctx>;
}

function ErrorLine({ children }: { children: string }) {
  return (
    <p role="alert" className="text-label-01 text-support-error">
      {children}
    </p>
  );
}

/** The hero's second button: only for a demo seat. */
export function StartAsDan() {
  const { status, startAs } = useGuideDemo();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!status?.demo) return null;
  return (
    <div className="flex flex-col gap-02">
      <Button
        kind="tertiary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setFailed(false);
          try {
            await startAs("dan", "/home");
          } catch {
            setFailed(true);
            setPending(false);
          }
        }}
      >
        Start as Dan
      </Button>
      {failed && (
        <ErrorLine>
          Couldn&apos;t switch to Dan. Reset the demo and try again.
        </ErrorLine>
      )}
    </div>
  );
}

/** R9: the demo's clock, reset, personas, accounts and raw event counts. */
export function DemoSection() {
  const { status, expectOrgId, startAs } = useGuideDemo();
  if (!status) return null;
  return (
    <section aria-labelledby="demo-controls" className="flex flex-col gap-07">
      <h2 id="demo-controls" className="text-heading-01 font-light">
        Demo controls
      </h2>
      {status.demo ? (
        <DemoControls
          demo={status.demo}
          expectOrgId={expectOrgId}
          startAs={startAs}
        />
      ) : (
        <div className="flex flex-col items-start gap-05">
          <InlineNotification title="Start as Priya first.">
            The demo controls work from a seat in Calder Lane. Priya has one
            from the start.
          </InlineNotification>
          <Button
            kind="secondary"
            onClick={() => void startAs("priya", "/guide")}
          >
            Start as Priya
          </Button>
        </div>
      )}
    </section>
  );
}

function DemoControls({
  demo,
  expectOrgId,
  startAs,
}: {
  demo: Demo;
  expectOrgId: Id<"orgs"> | null;
  startAs: (who: Persona, to: string) => Promise<void>;
}) {
  const setClock = useMutation(api.demo.setClock);
  const reset = useMutation(api.demo.reset);
  const password = useQuery(api.demo.personaPassword, {});
  const [moving, setMoving] = useState(false);
  const [moveFailed, setMoveFailed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const targets = forwardTargets(demo.demoNow);

  return (
    <div className="flex flex-col gap-07">
      <div className="flex flex-col gap-05">
        <div className="flex flex-col gap-02">
          <span className="text-label-01 text-text-secondary">Demo time</span>
          <span className="text-heading-03">
            {hourLong(demo.demoNow, DEMO_TIME_ZONE)}
          </span>
        </div>
        {targets.length > 0 ? (
          <form
            className="flex flex-wrap items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              const target = new FormData(e.currentTarget).get("target");
              setMoving(true);
              setMoveFailed(false);
              try {
                if (!expectOrgId) throw new Error("Rendered without a seat.");
                await setClock({
                  target: target as DemoTarget,
                  expectOrgId,
                });
                window.location.reload();
              } catch {
                setMoveFailed(true);
                setMoving(false);
              }
            }}
          >
            <div className="w-full max-w-80">
              <Select
                id="demo-target"
                name="target"
                label="Move the demo to"
                options={targets.map(({ target, label }) => ({
                  value: target,
                  label,
                }))}
              />
            </div>
            <Button type="submit" kind="secondary" size="md" disabled={moving}>
              Move clock
            </Button>
          </form>
        ) : (
          <p className="text-body-02">
            The sprint is complete. Reset the demo to start again.
          </p>
        )}
        {moveFailed && (
          <ErrorLine>
            Couldn&apos;t move the clock. Reload the page and try again.
          </ErrorLine>
        )}
        <div>
          <Modal
            trigger={<Button kind="danger">Reset demo</Button>}
            title="Reset the demo?"
            description="Calder Lane goes back to Tuesday 1 September at 9:30 AM. Everything added since is removed, including your changes."
            primaryText="Reset demo"
            primaryKind="danger"
            primaryDisabled={resetting}
            secondaryText="Cancel"
            onPrimary={async () => {
              // Read before the await: a reset takes Dan's seat, so status changes under us.
              const wasPriya = demo.persona === "priya";
              setResetting(true);
              setResetFailed(false);
              try {
                if (!expectOrgId) throw new Error("Rendered without a seat.");
                await reset({ expectOrgId });
                // R3: the reset ends as Priya on the guide.
                if (wasPriya) window.location.reload();
                else await startAs("priya", "/guide");
              } catch {
                setResetFailed(true);
                setResetting(false);
              }
            }}
          >
            {resetFailed && (
              <ErrorLine>
                Couldn&apos;t reset the demo. Reload the page and try again.
              </ErrorLine>
            )}
          </Modal>
        </div>
      </div>

      <div className="flex flex-wrap gap-07">
        {demo.accounts.map((a) => (
          <div key={a.key} className="flex flex-col items-start gap-02">
            <Button
              kind="secondary"
              onClick={() => void startAs(a.key, "/home")}
            >
              {`Start as ${a.name.split(" ")[0]}`}
            </Button>
            <span className="text-label-01 text-text-secondary">
              {demo.persona === a.key
                ? `You're signed in as ${a.name.split(" ")[0]}`
                : a.jobTitle}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-06">
        {/* Only a table scrolls sideways, inside its own container. */}
        <div
          role="region"
          aria-label="Demo accounts"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[560px] border-t border-border-inverse text-left text-body-02">
            <thead className="bg-layer-selected">
              <tr>
                {["Name", "Email", "Job title"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="h-control-lg px-05 text-label-01 font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demo.accounts.map((a) => (
                <tr
                  key={a.key}
                  className="h-control-lg border-b border-border-subtle"
                >
                  <th scope="row" className="px-05 font-semibold">
                    {a.name}
                  </th>
                  <td className="px-05 font-mono">{a.email}</td>
                  <td className="px-05 text-text-secondary">{a.jobTitle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {typeof password === "string" && (
          <div className="w-full max-w-80">
            <PasswordInput
              id="demo-password"
              label="Shared password"
              readOnly
              value={password}
              helper="Every Calder Lane account uses it. It can't be changed."
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-05">
        <div className="flex flex-col gap-02">
          <h3 className="text-heading-03">What happened in this demo</h3>
          <p className="text-body-02 text-text-secondary">
            Totals since the last reset, from every account. No names.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-01 min-[672px]:grid-cols-3 min-[1056px]:grid-cols-5">
          {demo.counts.map(({ type, count }) => (
            <StatTile
              key={type}
              label={COUNT_LABELS[type]}
              value={String(count)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-03">
        <h3 className="text-heading-04">Good to know</h3>
        <ul className="max-w-[65ch] list-disc pl-05 text-body-02">
          <li>The clock only moves forward. Reset the demo to go back.</li>
          <li>
            If you edit a project the demo also fills in, the demo leaves it as
            you wrote it, so it may not count as saved or presented in week 4.
          </li>
          <li>
            Resetting removes everything added since Tuesday 1 September, for
            everyone using the demo.
          </li>
        </ul>
      </div>
    </div>
  );
}
