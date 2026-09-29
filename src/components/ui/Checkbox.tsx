import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export type CheckboxProps = { label: ReactNode; helper?: string } & Omit<
  ComponentProps<"input">,
  "type" | "children"
>;

export function Checkbox({
  label,
  helper,
  className,
  ...input
}: CheckboxProps) {
  return (
    <label className={clsx("ltw-cb", className)}>
      <input type="checkbox" {...input} />
      <span>
        {label}
        {helper && <span className="ltw-cb-h ltw-help">{helper}</span>}
      </span>
    </label>
  );
}
