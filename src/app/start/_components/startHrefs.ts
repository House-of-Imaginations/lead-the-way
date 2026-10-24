export type StartState = { signedIn: boolean; team: boolean; career: boolean };

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
