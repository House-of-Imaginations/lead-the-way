"use client";

import Link from "next/link";
import { useState } from "react";
import { useGuideDemo } from "./GuideDemo";
import type { Step } from "./guideContent";

/** One walkthrough step: a 3px top rule, blue for Priya's steps and ink for Dan's (R8). */
export function StepTile({ step }: { step: Step }) {
  const { status, startAs } = useGuideDemo();
  const demo = status?.demo;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // R5: in the demo, a step for the other persona switches first.
  const switching = demo != null && demo.persona !== step.persona;
  return (
    <Link
      href={step.href}
      prefetch={false}
      onClick={(e) => {
        if (status === undefined) {
          e.preventDefault();
          return;
        }
        if (!switching) return;
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setFailed(false);
        startAs(step.persona, step.href).catch(() => {
          setFailed(true);
          setPending(false);
        });
      }}
      className={`flex flex-col gap-03 border-t-[3px] bg-layer-01 p-05 pb-07 transition-colors duration-[70ms] ease-productive hover:bg-layer-hover ${
        step.persona === "priya"
          ? "border-interactive"
          : "border-border-inverse"
      }`}
    >
      <span className="text-label-01 text-text-secondary">{step.eyebrow}</span>
      <span className="text-heading-03 text-text-primary">{step.title}</span>
      <span className="text-body-02 text-text-secondary">{step.detail}</span>
      {failed && (
        <span role="alert" className="text-label-01 text-support-error">
          Couldn&apos;t switch persona. Reload the page and try again.
        </span>
      )}
    </Link>
  );
}
