import type { ReactNode } from "react";

export type StatTileProps = {
  label: string;
  /** Preformatted: "7", "40 min", "Hidden". Team totals only. */
  value: string;
  suffix?: string;
  helper?: string;
  children?: ReactNode;
};

export function StatTile({
  label,
  value,
  suffix,
  helper,
  children,
}: StatTileProps) {
  return (
    <div className="ltw-stat">
      <span className="ltw-stat-l">{label}</span>
      <span className="ltw-stat-v">
        {value}
        {suffix && <span className="ltw-stat-s">{suffix}</span>}
      </span>
      {children}
      {helper && <span className="ltw-help">{helper}</span>}
    </div>
  );
}
