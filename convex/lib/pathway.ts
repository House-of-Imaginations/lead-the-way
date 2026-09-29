/**
 * The manager pathway, "Leading AI at Work". Content, not user data, so it is a
 * constant and not a table: nobody edits it at run time. The required modules
 * are from `docs/design/data-model.md`; the four coaching titles are drafts
 * for review (60 minutes in all, so 39 minutes is the 65% on the dashboard).
 */
export const PATHWAY_MODULES = [
  {
    key: "shared-norms",
    pathway: "required",
    title: "Why your team needs shared AI norms",
    minutes: 5,
  },
  {
    key: "without-micromanaging",
    pathway: "required",
    title: "Supporting AI learning without micromanaging",
    minutes: 10,
  },
  {
    key: "team-agreement",
    pathway: "required",
    title: "Creating your Team AI Agreement",
    minutes: 10,
  },
  {
    key: "coaching-conversations",
    pathway: "coaching",
    title: "Starting honest conversations about AI use",
    minutes: 15,
  },
  {
    key: "coaching-first-task",
    pathway: "coaching",
    title: "Coaching a first real task",
    minutes: 15,
  },
  {
    key: "coaching-feedback",
    pathway: "coaching",
    title: "Giving feedback on AI-assisted work",
    minutes: 15,
  },
  {
    key: "coaching-habit",
    pathway: "coaching",
    title: "Keeping the habit after the sprint",
    minutes: 15,
  },
] as const;

export type ModuleKey = (typeof PATHWAY_MODULES)[number]["key"];
