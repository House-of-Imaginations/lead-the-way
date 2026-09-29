import {
  CheckmarkOutline,
  RadioButton,
  RadioButtonChecked,
} from "@carbon/icons-react";

export type Step = { label: string; helper?: string };
export type ProgressStepsProps = {
  label: string;
  steps: Step[];
  current: number;
};

const ICONS = {
  done: CheckmarkOutline,
  current: RadioButtonChecked,
  todo: RadioButton,
} as const;

export function ProgressSteps({ label, steps, current }: ProgressStepsProps) {
  return (
    <ol className="ltw-steps" aria-label={label}>
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const Icon = ICONS[state];
        return (
          <li
            key={i}
            className={`ltw-step ltw-step-${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <Icon className="ltw-i" aria-hidden="true" />
            <span className="ltw-step-label">
              {state === "done" && <span className="sr-only">Done: </span>}
              {step.label}
              {step.helper && <span className="ltw-step-h">{step.helper}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
