import type { ReactNode } from "react";

export type FieldProps = {
  id: string;
  label: string;
  helper?: string;
  error?: string;
};

/** A control's aria-describedby: its error, else its helper, then any ids the caller passed. */
export function describedBy(
  id: string,
  helper?: string,
  error?: string,
  extra?: string,
) {
  const own = error ? `${id}-error` : helper ? `${id}-helper` : undefined;
  return [own, extra].filter(Boolean).join(" ") || undefined;
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
