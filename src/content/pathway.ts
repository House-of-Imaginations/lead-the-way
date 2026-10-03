import { PATHWAY_MODULES, type ModuleKey } from "@convex/lib/pathwayModules";

export type ModuleContent = {
  title: string;
  objective: string;
  idea: string;
  video: string;
  captions: string;
};

const COPY: Record<ModuleKey, Pick<ModuleContent, "objective" | "idea">> = {
  "shared-norms": {
    objective:
      "See why consistent, visible AI use reduces risk and hidden workarounds.",
    idea: "When everyone improvises alone, good practice stays invisible and risky habits spread quietly. Shared norms turn AI use into something the team can talk about.",
  },
  "without-micromanaging": {
    objective:
      "Protect time and celebrate application while keeping individual learning private.",
    idea: "Your job is to protect the hour and use AI openly yourself, not to track who finished what. Lead the Way only ever shows you team totals.",
  },
  "team-agreement": {
    objective: "Run a 30-minute conversation that ends with four shared rules.",
    idea: "Four questions: which tools we use, what never goes in, how we check outputs, and who to ask. Write the answers together, then everyone signs, including you.",
  },
  // ponytail: placeholder copy until the user supplies the coaching modules
  "coaching-conversations": {
    objective: "Open an honest conversation about how your team uses AI today.",
    idea: "Placeholder module. The final coaching content is on its way.",
  },
  "coaching-first-task": {
    objective: "Help each person choose a first real task to try with AI.",
    idea: "Placeholder module. The final coaching content is on its way.",
  },
  "coaching-feedback": {
    objective: "Give useful feedback on work made with help from AI.",
    idea: "Placeholder module. The final coaching content is on its way.",
  },
  "coaching-habit": {
    objective: "Keep the protected hour going after the sprint ends.",
    idea: "Placeholder module. The final coaching content is on its way.",
  },
};

/**
 * Module copy and media, keyed like `PATHWAY_MODULES` (titles come from there).
 * One placeholder clip serves every module until the real videos arrive
 * (Ruling 22); swapping them in is a file drop plus the `video` path here.
 */
export const PATHWAY_CONTENT = Object.fromEntries(
  PATHWAY_MODULES.map((m) => [
    m.key,
    {
      title: m.title,
      ...COPY[m.key],
      video: "/pathway/placeholder.mp4",
      captions: `/pathway/${m.key}.vtt`,
    },
  ]),
) as Record<ModuleKey, ModuleContent>;
