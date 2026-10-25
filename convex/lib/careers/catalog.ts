/**
 * The Change careers catalog (spec 4, 6.3): content, not user data, so it is
 * code and not tables, with string ids the career tables store. Data Analyst
 * is the pack's (careers `data-model.md`); Business Analyst and the week 1
 * and fourth lessons are drafts in the same pattern. Example data throughout.
 * Pure: `src` may import it.
 */

export const CREDENTIALS = [
  { id: "data-fundamentals", name: "Data Fundamentals" },
  { id: "data-visualisation", name: "Data visualisation" },
  { id: "ai-fundamentals", name: "AI Fundamentals" },
  {
    id: "business-analysis-fundamentals",
    name: "Business Analysis Fundamentals",
  },
] as const;

export type CredentialId = (typeof CREDENTIALS)[number]["id"];

type Skill = {
  name: string;
  credentialId: CredentialId;
  jobAd: { title: string; place: string; quote: string };
};

export const TARGETS = [
  {
    id: "data-analyst",
    name: "Data Analyst",
    skills: [
      {
        name: "Excel and data",
        credentialId: "data-fundamentals",
        jobAd: {
          title: "Junior Data Analyst",
          place: "Melbourne CBD",
          quote: "Strong Excel skills, cleaning and joining data. SQL a plus.",
        },
      },
      {
        name: "Data visualisation",
        credentialId: "data-visualisation",
        jobAd: {
          title: "Data Analyst",
          place: "Footscray",
          quote:
            "Build clear dashboards in Power BI or Tableau for store teams.",
        },
      },
      {
        name: "AI fundamentals",
        credentialId: "ai-fundamentals",
        jobAd: {
          title: "Reporting Analyst",
          place: "Docklands",
          quote:
            "Use AI tools responsibly to speed up analysis and check the results.",
        },
      },
    ],
  },
  {
    id: "business-analyst",
    name: "Business Analyst",
    skills: [
      {
        name: "Requirements and process mapping",
        credentialId: "business-analysis-fundamentals",
        jobAd: {
          title: "Junior Business Analyst",
          place: "Melbourne CBD",
          quote:
            "Gather requirements from stakeholders and map current processes.",
        },
      },
      {
        name: "Data for decisions",
        credentialId: "data-fundamentals",
        jobAd: {
          title: "Business Analyst",
          place: "Docklands",
          quote:
            "Comfortable with Excel and turning data into recommendations.",
        },
      },
      {
        name: "AI fundamentals",
        credentialId: "ai-fundamentals",
        jobAd: {
          title: "Business Analyst",
          place: "Southbank",
          quote: "Use AI tools responsibly to draft and check analysis.",
        },
      },
    ],
  },
] as const satisfies readonly {
  id: string;
  name: string;
  skills: readonly Skill[];
}[];

export type TargetId = (typeof TARGETS)[number]["id"];

/** Tell us, step 1 (spec 11.6): the pack's four, Account Executive, Something else. */
export const CURRENT_ROLES = [
  "Retail Store Manager",
  "Hospitality Supervisor",
  "Administration Officer",
  "Primary Teacher",
  "Account Executive",
  "Something else",
] as const;

const STRENGTHS: Record<string, { strengths: string[]; note: string }> = {
  "Retail Store Manager": {
    strengths: [
      "Sales reporting",
      "Leading a team",
      "Problem-solving",
      "Rosters and budgets",
    ],
    note: "From six years running a store",
  },
  // Spec 6.3 drafts these for "Senior Account Executive"; the list says Account Executive.
  "Account Executive": {
    strengths: [
      "Client relationships",
      "Reporting to clients",
      "Negotiation",
      "Understanding business needs",
    ],
    note: "From years running client accounts",
  },
};

const GENERIC_STRENGTHS = {
  strengths: [
    "Working with people",
    "Problem-solving",
    "Organising your time",
    "Explaining things clearly",
  ],
  note: "From your experience so far",
};

/** What the Pivot Map says you already have; any other role gets the generic set. */
export function strengthsFor(currentRole: string): {
  strengths: string[];
  note: string;
} {
  return STRENGTHS[currentRole] ?? GENERIC_STRENGTHS;
}

export type Hours = 1 | 2 | 3;

/** Weeks for the whole map at these hours a week, split evenly across its three credentials. */
export function weeksForHours(hours: Hours): {
  total: number;
  perCredential: number;
} {
  const total = 18 / hours;
  return { total, perCredential: total / 3 };
}

type LessonRow = [week: number, title: string, minutes: number, project?: true];

// ponytail: only the two credentials a crew works through in the demo have lessons; add the rest when a crew reaches credential 2.
const LESSON_ROWS: Partial<Record<CredentialId, LessonRow[]>> = {
  "data-fundamentals": [
    [1, "What a data analyst does", 10],
    [1, "Spreadsheets as data", 12],
    [1, "Sorting and filtering", 12],
    [2, "Excel basics for data", 12],
    [2, "Cleaning a messy table", 15],
    [2, "Project step: tidy a sales dataset", 20, true],
    [2, "Checking your totals", 10],
    [3, "Joining two tables", 15],
    [3, "Pivot tables for weekly trends", 15],
    [3, "Project step: build the summary table", 20, true],
    [3, "Explaining your numbers", 10],
  ],
  "business-analysis-fundamentals": [
    [1, "What a business analyst does", 10],
    [1, "Asking good questions", 12],
    [1, "Reading a process", 12],
    [2, "Stakeholders and their needs", 12],
    [2, "Mapping a current process", 15],
    [2, "Project step: map a real process", 20, true],
    [2, "Writing clear requirements", 10],
    [3, "Finding the gaps", 15],
    [3, "User stories that work", 15],
    [3, "Project step: write the requirements", 20, true],
    [3, "Presenting a recommendation", 10],
  ],
};

export type Lesson = {
  id: string;
  credentialId: CredentialId;
  week: number;
  order: number;
  title: string;
  minutes: number;
  kind: "lesson" | "project";
  hasAudio: boolean;
};

/** Every lesson, ids `<credentialId>-<n>` in credential order. */
export const LESSONS: Lesson[] = Object.entries(LESSON_ROWS).flatMap(
  ([credentialId, rows]) =>
    rows.map(([week, title, minutes, project], i) => ({
      id: `${credentialId}-${i + 1}`,
      credentialId: credentialId as CredentialId,
      week,
      order: i + 1,
      title,
      minutes,
      kind: project ? "project" : "lesson",
      hasAudio: !project,
    })),
);

export function lessonsFor(credentialId: CredentialId): Lesson[] {
  return LESSONS.filter((l) => l.credentialId === credentialId);
}
