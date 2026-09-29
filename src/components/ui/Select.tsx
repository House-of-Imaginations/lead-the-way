import { ChevronDown } from "@carbon/icons-react";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { Field, describedBy, type FieldProps } from "./Field";
import type { Option } from "./types";

export type SelectProps = FieldProps & { options: Option[] } & Omit<
    ComponentProps<"select">,
    "id" | "children"
  >;

export function Select({
  id,
  label,
  helper,
  error,
  options,
  className,
  ...select
}: SelectProps) {
  return (
    <Field id={id} label={label} helper={helper} error={error}>
      <div className="ltw-sel">
        <select
          id={id}
          className={clsx("ltw-field", error && "ltw-field-invalid", className)}
          aria-invalid={error ? true : undefined}
          {...select}
          aria-describedby={describedBy(
            id,
            helper,
            error,
            select["aria-describedby"],
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="ltw-i" aria-hidden="true" />
      </div>
    </Field>
  );
}
