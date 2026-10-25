import { ArrowRight } from "@carbon/icons-react";
import clsx from "clsx";

export type MapSummaryData = {
  currentRole: string;
  target: string;
  strengths: number;
  skills: number;
  weeks: number;
  hours: number;
};

/** 3b and DA: the map above the sign-up form, so people see what they keep. */
export function MapSummary({
  map,
  className,
}: {
  map: MapSummaryData;
  className?: string;
}) {
  const stats = [
    [map.strengths, "strengths"],
    [map.skills, "skills to build"],
    [map.weeks, `weeks at ${map.hours} ${map.hours === 1 ? "hr" : "hrs"}`],
  ] as const;
  return (
    <div className={clsx("flex flex-col gap-04 p-05", className)}>
      <span className="ltw-tag ltw-tag-blue self-start">
        {map.currentRole}
        <ArrowRight size={12} aria-label="to" />
        {map.target}
      </span>
      <dl className="grid grid-cols-3 border-t border-border-inverse pt-04">
        {stats.map(([value, label]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-label-01 text-text-secondary">{label}</dt>
            <dd className="text-heading-03 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
