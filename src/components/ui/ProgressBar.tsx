export type ProgressBarProps = {
  label: string;
  value: number;
  max: number;
  /** A count such as "5 of 8 teammates". Defaults to a rounded percentage. */
  valueText?: string;
  helper?: string;
  /** Keep the label for assistive tech only, e.g. inside a StatTile. */
  hideLabel?: boolean;
};

export function ProgressBar({
  label,
  value,
  max,
  valueText,
  helper,
  hideLabel,
}: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="ltw-pb">
      {!hideLabel && (
        <div className="ltw-pb-head">
          <span>{label}</span>
          <span className="ltw-pb-v">
            {valueText ?? `${Math.round(ratio * 100)}%`}
          </span>
        </div>
      )}
      <div
        className="ltw-pb-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
      >
        <span
          className="ltw-pb-fill"
          style={{ transform: `scaleX(${ratio})`, transformOrigin: "left" }}
        />
      </div>
      {helper && <span className="ltw-help">{helper}</span>}
    </div>
  );
}
