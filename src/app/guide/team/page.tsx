import { ArrowRight } from "@carbon/icons-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import {
  ASSUMPTIONS,
  CRITERIA_NOTE,
  HMW,
  LEAD,
  PANELS,
  STEPS,
  WALKTHROUGH_NOTE,
} from "../_components/guideContent";
import {
  DemoSection,
  GuideDemoProvider,
  StartAsDan,
} from "../_components/GuideDemo";
import { StepTile } from "../_components/StepTile";

export const metadata: Metadata = {
  title: "Grow in my role guide · From Zero to Hero",
};

/** Main: the Grow in my role guide (MASTER_PROMPT 9). The layout gates it. */
export default function TeamGuidePage() {
  return (
    <GuideDemoProvider>
      <section className="grid items-end gap-09 min-[900px]:grid-cols-[6fr_5fr]">
        <div className="flex flex-col gap-07">
          <h1 className="text-display-01 font-light">From Zero to Hero</h1>
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

      <section aria-labelledby="walkthrough" className="flex flex-col gap-07">
        <div className="flex flex-wrap items-end justify-between gap-05">
          <h2 id="walkthrough" className="text-heading-01 font-light">
            Walkthrough
          </h2>
          <p className="text-body-02 text-text-secondary">{WALKTHROUGH_NOTE}</p>
        </div>
        <div className="grid gap-01 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <StepTile key={step.title} step={step} />
          ))}
        </div>
      </section>

      <section aria-labelledby="assumptions" className="flex flex-col gap-07">
        <h2 id="assumptions" className="text-heading-01 font-light">
          Assumptions under test
        </h2>
        {/* Only a table scrolls sideways, inside its own container. */}
        <div
          role="region"
          aria-label="Assumptions table"
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
                  <dt className="font-semibold tabular-nums">{row.figure}</dt>
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
  );
}
