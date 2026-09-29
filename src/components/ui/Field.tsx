import type { ReactNode } from "react";

export type FieldProps = {
  id: string;
  label: string;
  helper?: string;
  error?: string;
};

/** The id a control's aria-describedby points at: its error, else its helper. */
export function describedBy(id: string, helper?: string, error?: string) {
  if (error) return `${id}-error`;
  if (helper) return `${id}-helper`;
  return undefined;
}

/** Label above, control, then the error or the helper below. */
export function Field({
  id,
  label,
  helper,
  error,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <div className="ltw-fld">
      <label className="ltw-lbl" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="ltw-err">
          {error}
        </span>
      ) : helper ? (
        <span id={`${id}-helper`} className="ltw-help">
          {helper}
        </span>
      ) : null}
    </div>
  );
}
