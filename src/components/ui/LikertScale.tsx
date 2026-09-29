export type LikertScaleProps = {
  name: string;
  legend: string;
  value: number | null;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
};

const POINTS = [1, 2, 3, 4, 5] as const;

/** 1 to 5, native radios: arrow keys and form semantics come for free. */
export function LikertScale({
  name,
  legend,
  value,
  onChange,
  minLabel,
  maxLabel,
}: LikertScaleProps) {
  const nameFor = (n: number) =>
    n === 1 ? `1, ${minLabel}` : n === 5 ? `5, ${maxLabel}` : String(n);
  return (
    <fieldset className="ltw-lk">
      <legend>{legend}</legend>
      <div className="ltw-lk-o">
        {POINTS.map((n) => (
          <label key={n}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={nameFor(n)}
            />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
      <div className="ltw-lk-ends" aria-hidden="true">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </fieldset>
  );
}
