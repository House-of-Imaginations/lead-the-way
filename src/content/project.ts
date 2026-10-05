import type { ProjectFields } from "@convex/projects";

/**
 * 12's content, from screens.md. "Use Dan's example" fills the words only:
 * the two safety checks are always the person's own to tick.
 */
export const DANS_EXAMPLE: Omit<ProjectFields, "humanReviewed" | "dataSafe"> =
  {
    title: "AI-assisted weekly client reporting",
    before:
      "Preparing the weekly client report usually took around two hours and required manually structuring the first draft.",
    change:
      "I created a reusable AI prompt to structure the first draft, then checked all client metrics manually.",
    after: "The process now takes about 1 hour 20 minutes.",
    resultTypes: ["Time saved"],
    headline: "40 minutes saved per week",
  };

/** The aside's list. `ok: false` is the one thing not to do. */
export const BEFORE_YOU_START = [
  { label: "Use approved tools: Copilot, ChatGPT Enterprise", ok: true },
  { label: "Use de-identified or sample data", ok: true },
  { label: "A person reviews every output", ok: true },
  { label: "Don't upload confidential work files", ok: false },
] as const;
