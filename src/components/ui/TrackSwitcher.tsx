import { Locked, Location } from "@carbon/icons-react";
import Link from "next/link";
import { Avatar } from "./Avatar";

export type TrackSwitcherRow = {
  kind: "team" | "career";
  name: string;
  caption: string;
  initials?: string;
  private: boolean;
  href: string;
};
export type TrackSwitcherProps = {
  rows: TrackSwitcherRow[];
  selected: "team" | "career";
};

/** "Your tracks" at the top of the side nav. Rows are links: the shell follows the route. */
export function TrackSwitcher({ rows, selected }: TrackSwitcherProps) {
  return (
    // aria-label, not aria-labelledby: the rail hides the heading's text, and the group keeps its name.
    <div role="group" aria-label="Your tracks">
      <div className="ltw-sn-h" aria-hidden="true">
        <span className="ltw-sn-t">Your tracks</span>
      </div>
      {rows.map((row) => {
        const Icon = row.private ? Locked : Location;
        return (
          <Link
            key={row.kind}
            className="ltw-sn-tr"
            href={row.href}
            title={`${row.name}, ${row.caption}`}
            aria-current={row.kind === selected ? "true" : undefined}
          >
            {row.kind === "team" ? (
              <Avatar initials={row.initials ?? ""} kind="org" />
            ) : (
              <span className="ltw-sn-sq" aria-hidden="true">
                <Icon className="ltw-i" />
              </span>
            )}
            <span className="ltw-sn-who ltw-sn-t">
              <span className="ltw-sn-name">{row.name}</span>
              <span className="ltw-sn-sub">{row.caption}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
