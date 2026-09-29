"use client";

import { View, ViewOff } from "@carbon/icons-react";
import clsx from "clsx";
import { useState } from "react";
import { Field, describedBy } from "./Field";
import type { TextInputProps } from "./TextInput";

export type PasswordInputProps = Omit<TextInputProps, "type">;

export function PasswordInput({
  id,
  label,
  helper,
  error,
  className,
  ...input
}: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  const Icon = shown ? ViewOff : View;
  return (
    <Field id={id} label={label} helper={helper} error={error}>
      <div className="ltw-pw">
        <input
          id={id}
          type={shown ? "text" : "password"}
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
        <button
          type="button"
          className="ltw-pw-b"
          aria-label="Show password"
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((s) => !s)}
        >
          <Icon className="ltw-i" aria-hidden="true" />
        </button>
      </div>
    </Field>
  );
}
