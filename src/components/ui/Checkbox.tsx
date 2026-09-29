import clsx from "clsx";
import { useId, type ComponentProps, type ReactNode } from "react";

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
  const helperId = useId();
  return (
    <div className={clsx("ltw-cb", className)}>
      <label className="ltw-cb-l">
        <input
          type="checkbox"
          {...input}
          aria-describedby={
            [helper && helperId, input["aria-describedby"]]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        <span>{label}</span>
      </label>
      {helper && (
        <span id={helperId} className="ltw-cb-h ltw-help">
          {helper}
        </span>
      )}
    </div>
  );
}
