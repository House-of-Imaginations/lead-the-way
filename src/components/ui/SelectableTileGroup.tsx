import { useId } from "react";

export type SelectableTileGroupProps = {
  legend: string;
  name: string;
  options: { value: string; title: string; description?: string }[];
  value: string | null;
  onChange: (value: string) => void;
};

/**
 * One choice drawn as tiles (03, Ruling 23). Native radios, as in
 * LikertScale: arrow keys and form semantics come for free. The label wraps
 * the whole tile, so the title names the radio and the line under it
 * describes it. SelectableTile stays the multi-select.
 */
export function SelectableTileGroup({
  legend,
  name,
  options,
  value,
  onChange,
}: SelectableTileGroupProps) {
  const id = useId();
  return (
    <fieldset className="ltw-tiles">
      <legend className="ltw-lbl">{legend}</legend>
      <div className="ltw-tiles-o">
        {options.map((o, i) => (
          <label key={o.value} className="ltw-tile ltw-tile-radio">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              aria-labelledby={`${id}-${i}`}
              aria-describedby={o.description ? `${id}-${i}-d` : undefined}
            />
            <span>
              <span id={`${id}-${i}`} className="ltw-tile-title">
                {o.title}
              </span>
              {o.description && (
                <span id={`${id}-${i}-d`} className="ltw-tile-desc">
                  {o.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
