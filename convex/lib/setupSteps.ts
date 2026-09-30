/**
 * 03's five steps, named once. Pure data with no server imports, so both the
 * side nav checklist (`convex/lib/shell.ts`) and the setup pages
 * (`src/app/setup/steps.ts`, reused by P4) read this one list.
 */
export const SETUP_STEPS = [
  { label: "Your team", href: "/setup/team", helper: "2 minutes" },
  {
    label: "Protected hour",
    href: "/setup/protected-hour",
    helper: "1 minute",
  },
  { label: "Manager pathway", href: "/manager/learning", helper: "25 minutes" },
  {
    label: "Team agreement",
    href: "/manager/agreement",
    helper: "30 minutes, with your team",
  },
  { label: "Invite team", href: "/manager/sprint/launch", helper: "2 minutes" },
] as const;
