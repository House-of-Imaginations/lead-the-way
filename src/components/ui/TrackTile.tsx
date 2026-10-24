import type { CarbonIconType } from "@carbon/icons-react";
import { useId } from "react";
import { Tag } from "./Tag";

export type TrackTileProps = {
  kind: "team" | "career";
  title: string;
  body: string;
  tag: string;
  icon: CarbonIconType;
  selected: boolean;
  onSelect: () => void;
};

/**
 * One of the two tracks on Choose a track. The body states that track's
 * privacy rule. A native radio named "track", hidden, so the pair inside a
 * fieldset is one single choice; the title names it and the body describes it.
 */
export function TrackTile({
  kind,
  title,
  body,
  tag,
  icon: Icon,
  selected,
  onSelect,
}: TrackTileProps) {
  const id = useId();
  return (
    <label className="ltw-track">
      <input
        type="radio"
        name="track"
        value={kind}
        className="sr-only"
        checked={selected}
        onChange={onSelect}
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-b`}
      />
      <span className="ltw-track-top">
        <Icon size={20} className="ltw-track-i" aria-hidden="true" />
        <Tag color={kind === "team" ? "purple" : "blue"}>{tag}</Tag>
      </span>
      <span className="ltw-track-text">
        <span id={`${id}-t`} className="ltw-track-title">
          {title}
        </span>
        <span id={`${id}-b`} className="ltw-track-body">
          {body}
        </span>
      </span>
    </label>
  );
}
