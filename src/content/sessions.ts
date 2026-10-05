/**
 * AI Productivity Fundamentals: 4 sessions of 15 minutes (spec 7.3). Only
 * session 2 is from the pack. Sessions 1, 3 and 4 are draft copy for review.
 * `tip` is 12's "From this week's session".
 */
export const SESSIONS: { title: string; description: string; tip: string }[] = [
  {
    title: "What AI assistants do well",
    description:
      "Where AI helps with everyday work, and where it gets things wrong.",
    tip: "Start with low-risk tasks. Check every fact it gives you.",
  },
  {
    title: "Reusable prompt templates",
    description: "Writing reusable prompts for recurring work.",
    tip: "Write the structure once, then reuse it for work that repeats every week. Check every number it produces.",
  },
  {
    title: "Checking AI output",
    description: "Verifying facts, sources and tone before anything counts.",
    tip: "Treat the first answer as a draft. A person decides what ships.",
  },
  {
    title: "Building it into your week",
    description: "Turning one improvement into a habit, then sharing it.",
    tip: "Pick one task you'll keep doing this way, and tell the team how you check it.",
  },
];

/** 11's learn card: "Session 2: writing reusable prompts for recurring work." Counts from 1. */
export function sessionLine(session: number): string {
  const { description } = SESSIONS[session - 1]!;
  return `Session ${session}: ${description[0]!.toLowerCase()}${description.slice(1)}`;
}
