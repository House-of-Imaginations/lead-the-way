import type { Option } from "./types";

export type ContentSwitcherProps = {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

/** Two to five choices that all stay on screen. */
export function ContentSwitcher({
  label,
  options,
  value,
  onChange,
}: ContentSwitcherProps) {
  return (
    <div className="ltw-cs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
