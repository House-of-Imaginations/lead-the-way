"use client";

import {
  ArrowRight,
  Location,
  UserMultiple,
  ViewOff,
} from "@carbon/icons-react";
import Link from "next/link";
import { useId, useState } from "react";
import {
  Button,
  ButtonLink,
  SelectableTileGroup,
  TrackTile,
} from "@/components/ui";
import {
  type StartState,
  type Track,
  type Way,
  startReady,
} from "./startHrefs";

const WAYS = [
  { value: "lead", title: "I lead a team" },
  { value: "invited", title: "My manager invited me" },
];

/**
 * MS1: two tracks, then for Grow in my role how you are joining, unless the
 * account is already on a team. The footer follows the choice (R8 to R10).
 */
export function ChooseTrack({ state }: { state: StartState }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [way, setWay] = useState<Way | null>(null);
  const helpId = useId();

  const pick = (next: Track) => {
    setTrack(next);
    setWay(null);
  };

  const ready = startReady(state, track, way);
  const invited = track === "team" && way === "invited";
  const help = invited
    ? "Open the link in your invitation email to join your team."
    : track === "team"
      ? "Choose how you join to continue."
      : "Pick a track to continue.";
  // S2: twice, so focus order follows what people see. Below 1024px it sits
  // above the sticky footer; from 1024px, below the button (MS1D).
  const logIn = (className: string) =>
    !state.signedIn && (
      <p className={`text-body-02 ${className}`}>
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-link underline hover:text-link-hover"
        >
          Log in
        </Link>
      </p>
    );

  return (
    <div className="flex flex-1 flex-col gap-05 min-[1024px]:flex-none">
      <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-01 border-0 p-0 min-[1024px]:grid-cols-2">
        <legend className="sr-only">Choose a track</legend>
        <TrackTile
          kind="team"
          icon={UserMultiple}
          tag="Team sprint, 4 weeks"
          title="Grow in my role"
          body="With your team, in one hour a week your manager protects. Your manager sees team totals only."
          selected={track === "team"}
          onSelect={() => pick("team")}
        />
        <TrackTile
          kind="career"
          icon={Location}
          tag="Pivot Crews, about 9 weeks"
          title="Change careers"
          body="On your own, privately, with a guide and a crew. No employer ever sees it."
          selected={track === "career"}
          onSelect={() => pick("career")}
        />
      </fieldset>
      {track === "team" && !state.team && (
        <SelectableTileGroup
          legend="How are you joining?"
          name="way"
          options={WAYS}
          value={way}
          onChange={(v) => setWay(v as Way)}
        />
      )}
      <p className="flex gap-03 text-label-01 text-text-secondary min-[1024px]:hidden">
        <ViewOff size={16} className="shrink-0" aria-hidden="true" />
        Already in a team sprint? You can add a private Change careers track
        later. Your team never sees it.
      </p>
      {logIn("min-[1024px]:hidden")}
      {/* Below 1024px the footer comes last and sticks to the bottom, full bleed with its hairline (MS1). */}
      <div className="sticky bottom-0 -mx-05 mt-auto flex flex-col gap-03 border-t border-border-subtle bg-background p-05 md:-mx-09 md:px-09 min-[1024px]:static min-[1024px]:m-0 min-[1024px]:w-[320px] min-[1024px]:border-0 min-[1024px]:p-0">
        {ready ? (
          <ButtonLink href={ready.href} icon={ArrowRight} className="w-full">
            {ready.label}
          </ButtonLink>
        ) : (
          <Button
            disabled
            icon={ArrowRight}
            className="w-full"
            aria-describedby={helpId}
          >
            {invited ? "Open my invitation" : "Continue"}
          </Button>
        )}
        {!ready && (
          <p
            id={helpId}
            className="text-center text-label-01 text-text-secondary"
          >
            {help}
          </p>
        )}
      </div>
      {logIn("hidden min-[1024px]:block")}
    </div>
  );
}
