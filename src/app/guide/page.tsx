import { ArrowRight } from "@carbon/icons-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConvexClientProvider } from "@/app/_components/ConvexClientProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { getToken } from "@/lib/account/auth-server";
import { getHome, getShell } from "@/lib/account/queries";
import {
  ASSUMPTIONS,
  CRITERIA_NOTE,
  HMW,
  LEAD,
  PANELS,
  STEPS,
  WALKTHROUGH_NOTE,
} from "./_components/guideContent";
import {
  DemoSection,
  GuideDemoProvider,
  StartAsDan,
} from "./_components/GuideDemo";
import { StepTile } from "./_components/StepTile";

export const metadata: Metadata = { title: "Prototype guide · Lead the Way" };

const DISCLAIMER = "Concept prototype. Not an official IBM product.";

/**
 * Main: the prototype guide (MASTER_PROMPT 9). Private (G-a): the proxy sends a
 * signed-out visitor to log in. Any signed-in session may read it, seated or
 * not (Review Focus 1): only a cookie Convex rejects goes to /signed-out.
 */
export default async function GuidePage() {
  const [token, shell] = await Promise.all([getToken(), getShell()]);
  if (shell === null && (await getHome()) === null) redirect("/signed-out");
  return (
    <ConvexClientProvider initialToken={token}>
      {/* R7: a 40px background bar, not Main.png's dark strip. */}
      <header className="flex min-h-control-md flex-wrap items-center justify-between gap-x-05 border-b border-border-subtle px-05 md:px-07">
        <span className="flex items-center gap-[10px] text-body-02">
          <Logo />
          <span className="font-semibold">Lead the Way</span>
          <span className="text-text-secondary">Prototype guide</span>
        </span>
        <span className="text-label-01 text-text-secondary">{DISCLAIMER}</span>
      </header>
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-05 py-09 md:px-10">
        <GuideDemoProvider
          expectOrgId={shell?.isDemo ? shell.expectOrgId : null}
        >
          <section className="grid items-end gap-09 min-[900px]:grid-cols-[6fr_5fr]">
            <div className="flex flex-col gap-07">
              <h1 className="text-display-01 font-light">Lead the Way</h1>
              <p className="max-w-[36rem] text-heading-03 text-text-secondary">
                {LEAD}
              </p>
              <div className="flex flex-wrap gap-05">
                <ButtonLink
                  href="/demo/partner-email"
                  icon={ArrowRight}
                  prefetch={false}
                >
                  Start the walkthrough
                </ButtonLink>
                <StartAsDan />
              </div>
            </div>
            <div className="flex flex-col gap-05 bg-highlight p-07">
              <span className="text-label-01 text-text-secondary">
                How might we
              </span>
              <p className="text-heading-03 font-light">{HMW}</p>
            </div>
          </section>

          <section
            aria-labelledby="walkthrough"
            className="flex flex-col gap-07"
          >
            <div className="flex flex-wrap items-end justify-between gap-05">
              <h2 id="walkthrough" className="text-heading-01 font-light">
                Walkthrough
              </h2>
              <p className="text-body-02 text-text-secondary">
                {WALKTHROUGH_NOTE}
              </p>
            </div>
            <div className="grid gap-01 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <StepTile key={step.title} step={step} />
              ))}
            </div>
          </section>

          <section
            aria-labelledby="assumptions"
            className="flex flex-col gap-07"
          >
            <h2 id="assumptions" className="text-heading-01 font-light">
              Assumptions under test
            </h2>
            {/* Only a table scrolls sideways, inside its own container. */}
            <div
              role="region"
              aria-labelledby="assumptions"
              tabIndex={0}
              className="overflow-x-auto"
            >
              <table className="w-full min-w-[720px] border-t border-border-inverse text-left text-body-02">
                <thead className="bg-layer-selected">
                  <tr>
                    {[
                      "Assumption",
                      "Question",
                      "Tested on",
                      "Observable behaviour",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="h-control-lg px-05 text-label-01 font-semibold first:w-56"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ASSUMPTIONS.map((a) => (
                    <tr
                      key={a.name}
                      className="border-b border-border-subtle align-top"
                    >
                      <th scope="row" className="px-05 py-05 font-semibold">
                        {a.name}
                      </th>
                      <td className="px-05 py-05">{a.question}</td>
                      <td className="px-05 py-05 text-text-secondary">
                        {a.testedOn}
                      </td>
                      <td className="px-05 py-05 text-text-secondary">
                        {a.behaviour}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-01 min-[900px]:grid-cols-2">
            {PANELS.map((panel) => (
              <div
                key={panel.title}
                className="flex flex-col gap-05 bg-layer-01 p-06"
              >
                <div>
                  <h2 className="text-heading-03">{panel.title}</h2>
                  <p className="text-body-02 text-text-secondary">
                    {panel.subtitle}
                  </p>
                </div>
                <dl className="flex flex-col">
                  {panel.rows.map((row) => (
                    <div
                      key={row.text}
                      className="grid grid-cols-[6rem_1fr] gap-05 border-t border-border-subtle py-04"
                    >
                      <dt className="font-semibold tabular-nums">
                        {row.figure}
                      </dt>
                      <dd className="text-body-02">{row.text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </section>

          <DemoSection />

          <p className="max-w-[65ch] text-body-02 text-text-secondary">
            {CRITERIA_NOTE}
          </p>
        </GuideDemoProvider>
      </main>
    </ConvexClientProvider>
  );
}
