/**
 * The research note behind each screen (spec 3.2 "Prototype notes"), copied
 * verbatim from docs/design/wireframes/screens.md; the parity test fails when
 * the two drift. One note per route: the desktop screen wins over M1 (R12).
 */
export const PROTOTYPE_NOTES: Record<
  string,
  { screen: string; lines: string[] }
> = {
  "/demo/partner-email": {
    screen: "01 Partner invitation email",
    lines: [
      "WHY: Tests whether an industry association or SME partner is a credible channel to reach managers of employed teams.",
      "HMW: Part of the working week",
      "TESTS: A1 Manager willingness (entry point)",
      "EVIDENCE, pin 1 VIABLE: extends IBM's best-performing wraparound partnership channel to employed teams (IBM Q&A 1 and 2).",
    ],
  },
  "/": {
    screen: "02 Landing page (superseded by docs/design/landing/index.html)",
    lines: [
      "WHY: Is the proposition clear and attractive enough for a manager to continue? Does '1 protected hour' read as a benefit or a cost?",
      "HMW: Working week, Openly valued",
      "TESTS: A1. Observe which CTA they choose and how they react to the privacy split.",
      "EVIDENCE, pins 1, 7, 8: partner channel; curates existing SkillsBuild content; aggregate-only, opt-in, not used for performance review.",
    ],
  },
  "/signup": {
    screen: "02a Sign up (shadcn login-02 layout)",
    lines: [
      "WHY: Priya creates her account after choosing 'Start the Manager Path' on the landing page, then goes straight into setup (03). Layout follows the shadcn login-02 split: form left, brand panel right.",
      "HMW: Working week",
      "TESTS: A1 drop-off between landing and setup. Password or single sign-on.",
      "NOTE: the panel's tile grid is Mon to Fri by four sprint weeks, with Wednesday (the protected hour) in blue.",
    ],
  },
  "/login": {
    screen: "02b Log in (shadcn login-02 layout)",
    lines: [
      "Returning users log in with a work email and password or single sign-on. 'Forgot your password?' shows an inline confirmation that never reveals whether the account exists. Below 1024px the brand panel hides and the form centres, as in login-02.",
    ],
  },
  "/setup/team": {
    screen: "03 Setup 1: your team",
    lines: [
      "WHY: Light tailoring, plus a baseline for norm-setting confidence (the A2 before measure).",
      "HMW: Working week, Used",
      "TESTS: A1 drop-off before the commitment; A2 baseline on a 1 to 5 scale.",
      "EVIDENCE, pin 2 OPENLY VALUED: managers want guidance first. 'My problem is eight people using the tool in eight different ways' (Andrew).",
    ],
  },
  "/setup/protected-hour": {
    screen: '04 Setup 2: protected hour (+ "not ready" dialog)',
    lines: [
      "WHY: The riskiest assumption. The screen asks for a commitment, not an opinion.",
      "HMW: Part of the working week",
      "TESTS: A1. Observe: commits or not, picks a recurring slot, hesitation, reasons given in the 'not ready' dialog. Target: 5 of 8 managers would commit.",
      "EVIDENCE, pin 4 WORKING WEEK: 'It's not the hours. It's which hour?' (Simon).",
    ],
  },
  "/manager/learning": {
    screen: "05 Manager pathway: Leading AI at Work",
    lines: [
      "WHY: The manager learns first, without building a new LMS. Three short curated modules.",
      "HMW: Openly valued, Completed",
      "TESTS: A2. Compare after-pathway confidence with the onboarding baseline. Target: +1 point.",
      "EVIDENCE, pins 2 and 7: guidance first; curates existing SkillsBuild content.",
    ],
  },
  "/manager/agreement": {
    screen: "06 Team AI Agreement builder",
    lines: [
      "WHY: Turns private, improvised AI habits into a visible team norm. The live preview shows the one-page output the team signs.",
      "HMW: Openly valued, Used",
      "TESTS: A2 completion and confusion by category; A4 'Using AI here is normal'.",
      "EVIDENCE, pins 3 and 9: targets mutual concealment (Simon, Andrew); formalises rules workers already improvise. 'I always take the brand name out' (Simon).",
    ],
  },
  "/manager/sprint/launch": {
    screen: "07 Launch sprint and invite team",
    lines: [
      "WHY: The team is invited only once time, training and norms are in place. The manager's message models open AI use.",
      "HMW: Working week, Openly valued",
      "TESTS: A1 trial-sprint signal (target: 2 of 8 managers launch); A4 tone of the message.",
      "EVIDENCE, pin 7 FEASIBLE: downloadable kit plus a lightweight grant agreement with the partner (Q&A 2).",
    ],
  },
  "/manager": {
    screen: "08 Manager overview",
    lines: [
      "WHY: Enough for the manager to keep the sprint alive without surveillance. No names, no individual percentages.",
      "HMW: Working week, Completed",
      "TESTS: A1. Is aggregate data enough? Watch for requests for individual data and reactions to 'Why can't I see individual progress?'",
      "EVIDENCE, pin 8 PRIVACY: aggregate-only, opt-in, not used for performance review (APPs, section 4).",
    ],
  },
  "/join/[token]": {
    screen: "09 Employee invitation",
    lines: [
      "WHY: Switches to Dan. The invitation carries protected time, a clear goal and a privacy promise, sent by his own manager.",
      "HMW: Working week, Openly valued",
      "TESTS: A4. Does a manager-sent invitation make AI learning feel legitimate?",
      "EVIDENCE, pins 4 and 8: protected working hour; aggregate-only visibility.",
    ],
  },
  "/me/agreement": {
    screen: "10 Read and sign the Team AI Agreement",
    lines: [
      "WHY: Dan reads and signs the norms the team agreed. Signing makes the rules shared rather than personal.",
      "HMW: Openly valued",
      "TESTS: A4 open legitimacy.",
      "EVIDENCE, pins 3 and 9: mutual concealment becomes a team norm; safe-use rules workers already improvise.",
    ],
  },
  "/me": {
    screen: "11 This week (employee home)",
    lines: [
      "WHY: Learning sits inside the working week, and every session pairs with a real task.",
      "HMW: Working week, Used",
      "TESTS: A3. Does Dan start a project from the Apply prompts?",
      "EVIDENCE, pin 5 USED, COMPLETED: 'I'd definitely finish it if it actually helped me with my work' (Simon, follow-up).",
    ],
  },
  "/me/project": {
    screen: "12 Work project: apply it to your work",
    lines: [
      "WHY: The core of A3. Before, change, after, a measurable result and two safety checks.",
      "HMW: Used in real work",
      "TESTS: A3. Do people create a project, describe before, change and after, and state a result?",
      "EVIDENCE, pins 5 and 9: a real task and an audience; safe-use rules.",
    ],
  },
  "/me/sprint": {
    screen: "13 My sprint (four-week progress)",
    lines: [
      "WHY: Four finite weeks, visible progress, and a clear reminder that this is work time.",
      "HMW: Working week, Completed",
      "TESTS: A3 and completion. Target: 70% complete the pathway.",
      "EVIDENCE, pin 4 WORKING WEEK: learning moves into paid time.",
    ],
  },
  "/me/show-and-tell": {
    screen: "14 Week 4 show and tell",
    lines: [
      "WHY: An audience gives a reason to finish, and sharing makes AI use discussable.",
      "HMW: Completed, Openly valued",
      "TESTS: A3 measurable outcome; A4 open discussion. Target: 60% present a project.",
      "EVIDENCE, pins 5 and 6: a real task and an audience; 'then I want to know the story behind it' (Andrew).",
    ],
  },
  "/me/credential": {
    screen: "15 Credential: badge plus applied reflection",
    lines: [
      "WHY: Reuses the existing SkillsBuild badge and adds evidence of application. No new credential technology.",
      "HMW: Openly valued",
      "TESTS: A3 and A4.",
      "EVIDENCE, pin 6 VISIBLE VALUE: badge = completion; the project = capability.",
    ],
  },
  "/manager/outcomes": {
    screen: "16 Sprint complete: team outcomes",
    lines: [
      "WHY: The manager sees team outcomes only, including the A4 survey item.",
      "HMW: all four outcomes",
      "TESTS: A2 and A4 before and after. Target: +1 point on comfort discussing AI with a manager.",
      "EVIDENCE, pin 8 PRIVACY. All figures are mock data.",
    ],
  },
  "/settings": {
    screen: "17 Personal settings (manager)",
    lines: [
      "Opened from the account menu at the bottom of the sidebar. Personal settings only: profile, reminders, and a note that Priya's own pathway progress is private too.",
    ],
  },
  "/workspace/settings": {
    screen: "18 Workspace settings",
    lines: [
      "Opened from the organisation switcher at the top of the sidebar or the account menu. Members has roles only, no participation status. Data and privacy adds a small-group threshold: team totals hide below 5 responses, supporting pin 8 PRIVACY.",
    ],
  },
  "/me/settings": {
    screen: "19 Personal settings (employee, opens on Privacy and sharing)",
    lines: [
      "Dan's settings open on Privacy and sharing: he controls what reaches the team, his credential and survey totals. Supports A4: open legitimacy needs a sense of control, not surveillance.",
    ],
  },
};

/** The note for a path: exact, then any /join/... as 09. Never the landing (R12). */
export function noteFor(pathname: string) {
  if (pathname === "/") return null;
  if (pathname.startsWith("/join/"))
    return PROTOTYPE_NOTES["/join/[token]"] ?? null;
  return PROTOTYPE_NOTES[pathname] ?? null;
}

const LABELS = {
  WHY: "Why",
  HMW: "How might we",
  TESTS: "Tests",
  NOTE: "Note",
  EVIDENCE: "Evidence",
} as const;
// The research pins' names are all caps on the canvas; DESIGN.md keeps caps off labels.
const PIN =
  /\b(VIABLE|OPENLY|VALUED|WORKING|WEEK|FEASIBLE|PRIVACY|USED|COMPLETED|VISIBLE|VALUE)\b/g;
const lowerPins = (s: string) => s.replace(PIN, (w) => w.toLowerCase());

/** "EVIDENCE, pin 1 VIABLE: text" into a display label and its text. */
export function splitNoteLine(line: string): {
  label: string | null;
  text: string;
} {
  const m = /^(WHY|HMW|TESTS|NOTE|EVIDENCE)([^:]*)(?::\s*([\s\S]*))?$/.exec(
    line,
  );
  if (!m) return { label: null, text: line };
  const label = LABELS[m[1] as keyof typeof LABELS];
  const rest = m[2] ?? "";
  if (m[3] === undefined)
    return { label, text: lowerPins(rest.replace(/^,\s*/, "")) };
  return { label: label + lowerPins(rest), text: m[3] };
}
