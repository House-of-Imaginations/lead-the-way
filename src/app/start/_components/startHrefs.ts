export type StartState = { signedIn: boolean; team: boolean; career: boolean };
export type Track = "team" | "career";
export type Way = "lead" | "invited";

/**
 * R10: where each choice on /start goes, following the account. A track the
 * account already has goes home; a team account adds a private career track.
 */
export function startHrefs(s: StartState): { lead: string; career: string } {
  return {
    lead: !s.signedIn
      ? "/signup?track=team"
      : s.team
        ? "/home"
        : "/setup/start",
    career: s.career
      ? "/home"
      : s.team
        ? "/tracks/private/new"
        : "/careers/map/new",
  };
}

/**
 * The footer link for a choice, or null until the choice is complete. A track
 * the account already has needs no way in: Continue goes home (R10).
 */
export function startReady(
  s: StartState,
  track: Track | null,
  way: Way | null,
): { label: string; href: string } | null {
  if (!track || (track === "team" && !s.team && way !== "lead")) return null;
  return {
    label: s[track]
      ? "Continue"
      : track === "team"
        ? "Set up team"
        : "Start my map",
    href: startHrefs(s)[track === "team" ? "lead" : "career"],
  };
}
