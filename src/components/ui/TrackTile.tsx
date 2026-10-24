import type { CarbonIconType } from "@carbon/icons-react";
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

/** One of the two tracks on Choose a track. The body states that track's privacy rule. */
export function TrackTile({
  kind,
  title,
  body,
  tag,
  icon: Icon,
  selected,
  onSelect,
}: TrackTileProps) {
  return (
    <button
      type="button"
      className="ltw-track"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="ltw-track-top">
        <Icon size={20} className="ltw-track-i" aria-hidden="true" />
        <Tag color={kind === "team" ? "purple" : "blue"}>{tag}</Tag>
      </span>
      <span className="ltw-track-title">{title}</span>
      <span className="ltw-track-body">{body}</span>
    </button>
  );
}
