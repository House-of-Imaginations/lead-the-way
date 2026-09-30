import type { Step } from "@/components/ui/ProgressSteps";

/** 03's five steps. P4 renders them on each setup page with its own `current`. */
export const SETUP_STEPS: Step[] = [
  { label: "Your team", helper: "2 minutes" },
  { label: "Protected hour", helper: "1 minute" },
  { label: "Manager pathway", helper: "25 minutes" },
  { label: "Team agreement", helper: "30 minutes, with your team" },
  { label: "Invite team", helper: "2 minutes" },
];
