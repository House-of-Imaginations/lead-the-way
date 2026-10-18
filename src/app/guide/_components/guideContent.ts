export type Persona = "priya" | "dan";
export type Step = {
  persona: Persona;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
};

export const LEAD =
  "A manager-first SkillsBuild team path. Priya learns first, sets shared AI norms and protects one paid hour a week. Dan learns inside that hour, applies it to a real task and shows what changed.";
export const HMW =
  "make AI learning part of the working week for mid-career professionals in AI-exposed roles, so that what they learn is used, completed and openly valued at work?";
// R6: the canvas wording ("Press Play", "on the canvas") becomes app wording.
export const WALKTHROUGH_NOTE =
  "Open any step. The account menu switches between Priya and Dan, and prototype notes show the research behind each screen.";

export const STEPS: Step[] = [
  {
    persona: "priya",
    eyebrow: "Priya, screens 01 to 03",
    title: "Accepts the invitation",
    detail: "Partner email, landing page, team details",
    href: "/demo/partner-email",
  },
  {
    persona: "priya",
    eyebrow: "Priya, screen 04",
    title: "Protects one hour",
    detail: "A recurring weekly slot and a commitment",
    href: "/setup/protected-hour",
  },
  {
    persona: "priya",
    eyebrow: "Priya, screen 05",
    title: "Completes the pathway",
    detail: "Leading AI at Work, about 25 minutes",
    href: "/manager/learning",
  },
  {
    persona: "priya",
    eyebrow: "Priya, screens 06 to 08",
    title: "Sets norms and launches",
    detail: "Team AI Agreement, invites, overview",
    href: "/manager/agreement",
  },
  // R5: the invitation needs a token and the script accepts it on 8 September, so Dan starts at 11.
  {
    persona: "dan",
    eyebrow: "Dan, screens 09 to 11",
    title: "Joins the sprint",
    detail: "Invitation, agreement, this week",
    href: "/me",
  },
  {
    persona: "dan",
    eyebrow: "Dan, screens 12 and 13",
    title: "Applies it to real work",
    detail: "Work project, weekly progress",
    href: "/me/project",
  },
  {
    persona: "dan",
    eyebrow: "Dan, screens 14 and 15",
    title: "Shares what changed",
    detail: "Show and tell, badge with reflection",
    href: "/me/show-and-tell",
  },
  {
    persona: "priya",
    eyebrow: "Priya, screen 16",
    title: "Sees team outcomes",
    detail: "Aggregate results only",
    href: "/manager/outcomes",
  },
];

export const ASSUMPTIONS = [
  {
    name: "A1 Manager willingness",
    question: "Will managers commit one protected hour per employee per week?",
    testedOn: "02 Landing, 03 Onboarding, 04 Protected hour, 07 Invite",
    behaviour: "Commits or not; picks a recurring time; hesitates or rejects",
  },
  {
    name: "A2 Norm-setting",
    question: "Can managers confidently create simple shared AI norms?",
    testedOn: "05 Pathway, 06 Agreement builder",
    behaviour:
      "Completes the agreement; confusion by category; confidence before and after",
  },
  {
    name: "A3 Workplace application",
    question:
      "Will employees translate course content into a genuine work task?",
    testedOn: "12 Work project, 14 Show and tell",
    behaviour:
      "Creates a project; describes before, change, after; states a measurable result",
  },
  {
    name: "A4 Open legitimacy",
    question:
      "Does manager participation and show and tell make AI use easier to discuss?",
    testedOn: "09 Invitation, 10 Agreement, 14 Show and tell, 16 Survey",
    behaviour:
      "“I feel comfortable telling my manager how I use AI at work.” Rated 1 to 5",
  },
];

export const PANELS = [
  {
    title: "Manager test",
    subtitle: "Recruit 8 managers",
    rows: [
      {
        figure: "5 of 8",
        text: "or more say they would commit protected time",
      },
      { figure: "2", text: "or more agree to launch a trial sprint" },
      {
        figure: "+1 point",
        text: "average confidence setting AI norms, 5-point scale",
      },
    ],
  },
  {
    title: "Team pilot",
    subtitle: "About 15 to 20 learners",
    rows: [
      { figure: "70%", text: "or more complete the selected learning pathway" },
      { figure: "60%", text: "or more present an applied workplace project" },
      {
        figure: "+1 point",
        text: "average comfort discussing AI with a manager",
      },
    ],
  },
];

export const CRITERIA_NOTE =
  "These are prototype test criteria, not verified product outcomes. All data is mocked. Course completion, invitations, calendar holds, badge issuance and sharing are simulated. Company, association and people are fictional.";
