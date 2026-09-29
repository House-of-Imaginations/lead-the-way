import { CheckmarkFilled, type CarbonIconType } from "@carbon/icons-react";

export type SelectableTileProps = {
  title: string;
  description?: string;
  icon?: CarbonIconType;
  selected: boolean;
  onChange: (selected: boolean) => void;
};

export function SelectableTile({
  title,
  description,
  icon: Icon,
  selected,
  onChange,
}: SelectableTileProps) {
  return (
    <button
      type="button"
      className="ltw-tile"
      aria-pressed={selected}
      onClick={() => onChange(!selected)}
    >
      {Icon && <Icon size={20} aria-hidden="true" />}
      <span>
        <span className="ltw-tile-title">{title}</span>
        {description && <span className="ltw-tile-desc">{description}</span>}
      </span>
      {selected && (
        <CheckmarkFilled className="ltw-i ltw-tile-check" aria-hidden="true" />
      )}
    </button>
  );
}
