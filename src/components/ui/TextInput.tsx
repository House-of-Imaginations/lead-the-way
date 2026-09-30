import clsx from "clsx";
import type { ComponentProps } from "react";
import { Field, describedBy, type FieldProps } from "./Field";

export type TextInputProps = FieldProps & Omit<ComponentProps<"input">, "id">;
export type TextAreaProps = FieldProps & Omit<ComponentProps<"textarea">, "id">;

export function TextInput({
  id,
  label,
  helper,
  error,
  labelAction,
  className,
  ...input
}: TextInputProps) {
  return (
    <Field
      id={id}
      label={label}
      helper={helper}
      error={error}
      labelAction={labelAction}
    >
      <input
        id={id}
        className={clsx("ltw-field", error && "ltw-field-invalid", className)}
        aria-invalid={error ? true : undefined}
        {...input}
        aria-describedby={describedBy(
          id,
          helper,
          error,
          input["aria-describedby"],
        )}
      />
    </Field>
  );
}

export function TextArea({
  id,
  label,
  helper,
  error,
  labelAction,
  className,
  rows = 3,
  ...textarea
}: TextAreaProps) {
  return (
    <Field
      id={id}
      label={label}
      helper={helper}
      error={error}
      labelAction={labelAction}
    >
      <textarea
        id={id}
        rows={rows}
        className={clsx("ltw-field", error && "ltw-field-invalid", className)}
        aria-invalid={error ? true : undefined}
        {...textarea}
        aria-describedby={describedBy(
          id,
          helper,
          error,
          textarea["aria-describedby"],
        )}
      />
    </Field>
  );
}
