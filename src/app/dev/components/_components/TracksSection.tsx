"use client";

import { Location, UserMultiple } from "@carbon/icons-react";
import { useState } from "react";
import {
  TrackSwitcher,
  TrackTile,
  WhoSeesWhat,
  type TrackSwitcherProps,
} from "@/components/ui";
import { Section } from "./Section";

/** Dan with a private career track, on a team route (R3). */
export const sampleTracks: TrackSwitcherProps = {
  selected: "team",
  rows: [
    {
      kind: "team",
      name: "Team sprint",
      caption: "Calder Lane, week 2 of 4",
      initials: "CL",
      private: false,
      href: "/me",
    },
    {
      kind: "career",
      name: "Change careers",
      caption: "Private",
      private: true,
      href: "/careers/journey",
    },
  ],
};

const WHO = [
  {
    who: "Priya, your manager",
    team: "Team totals, hidden below 5 people.",
    career: "Nothing. Not even that this track exists.",
  },
  {
    who: "Your crew",
    team: "Nothing.",
    career: "What you choose to share.",
  },
];

export function TracksSection() {
  const [track, setTrack] = useState<"team" | "career" | null>(null);
  return (
    <Section id="tracks" title="Tracks">
      <div className="grid max-w-[744px] gap-01 md:grid-cols-2">
        <TrackTile
          kind="team"
          title="Grow in my role"
          body="With your team, in one hour a week your manager protects. Your manager sees team totals only."
          tag="Team sprint, 4 weeks"
          icon={UserMultiple}
          selected={track === "team"}
          onSelect={() => setTrack("team")}
        />
        <TrackTile
          kind="career"
          title="Change careers"
          body="On your own, privately, with a guide and a crew. No employer ever sees it."
          tag="Pivot Crews, about 9 weeks"
          icon={Location}
          selected={track === "career"}
          onSelect={() => setTrack("career")}
        />
      </div>
      <div className="w-[256px] border border-border-subtle py-03">
        <TrackSwitcher {...sampleTracks} />
      </div>
      <div className="max-w-[960px]">
        <WhoSeesWhat rows={WHO} />
      </div>
    </Section>
  );
}
