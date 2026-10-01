/**
 * 08's resources, from screens.md. Content, not user data (spec 4.3). Every
 * action is simulated in the prototype, and a toast says so (spec 3.3).
 */
export const RESOURCES = [
  {
    title: "Inclusive facilitation guide",
    description: "For part-time, CALD and neurodivergent staff",
    action: "Open",
  },
  {
    title: "Responsible AI checklist",
    description: "Approved tools, de-identified data, human review",
    action: "Open",
  },
  {
    title: "Show and tell run sheet",
    description: "A 30-minute format for week 4",
    action: "Open",
  },
  {
    title: "15-minute mentor call",
    description: "With an IBM volunteer, through Month of Impact",
    action: "Book",
  },
] as const;
