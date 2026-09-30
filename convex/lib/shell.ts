import { literals } from "convex-helpers/validators";
import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { flagOn } from "../app";
import { castOf } from "./demo/cast";
import { MAX_MEMBERS_PER_ORG, seatsOfUser } from "./orgs/membership";
import { initialsOf } from "./orgs/people";
import { requiredDone } from "./pathway";
import { SETUP_STEPS } from "./setupSteps";
import { currentSprint, currentTeam } from "./sprint";
import { sprintStatus } from "./sprintTime";
import type { Viewer } from "./viewer";

/** Carbon icon names the nav may use. `AppShell` maps each to its component. */
export const NAV_ICONS = [
  "Dashboard",
  "Calendar",
  "DocumentTasks",
  "ChartColumn",
  "Education",
  "Catalog",
  "Home",
  "Portfolio",
  "PresentationFile",
  "Certificate",
] as const;
type Icon = (typeof NAV_ICONS)[number];

const linkValidator = v.object({
  label: v.string(),
  href: v.string(),
  icon: literals(...NAV_ICONS),
});

export const shellValidator = v.object({
  /** Echo it on every product mutation (R6). */
  expectOrgId: v.id("orgs"),
  /** The demo banner and the persona switch: the demo workspace with DEMO_MODE on. */
  isDemo: v.boolean(),
  area: literals("manager", "employee"),
  home: v.string(),
  greeting: v.string(),
  user: v.object({ name: v.string(), initials: v.string(), role: v.string() }),
  org: v.object({ name: v.string(), initials: v.string(), team: v.string() }),
  workspaces: v.array(
    v.object({ id: v.id("orgs"), name: v.string(), current: v.boolean() }),
  ),
  nav: v.array(
    v.object({
      title: v.union(v.null(), v.string()),
      links: v.array(linkValidator),
    }),
  ),
  checklist: v.union(
    v.null(),
    v.object({
      title: v.string(),
      items: v.array(
        v.object({
          label: v.string(),
          href: v.string(),
          state: literals("done", "current", "todo"),
        }),
      ),
    }),
  ),
  status: v.union(
    v.null(),
    v.object({
      heading: v.union(v.null(), v.string()),
      progress: v.union(
        v.null(),
        v.object({ value: v.number(), max: v.number() }),
      ),
      label: v.string(),
      value: v.string(),
      note: v.union(v.null(), v.string()),
    }),
  ),
  switchTo: v.union(
    v.null(),
    v.object({ label: v.string(), email: v.string() }),
  ),
});
export type Shell = Infer<typeof shellValidator>;

/** The manager area is a matter of permissions, never of a role's name (rule 6). */
export const isManager = (viewer: Viewer) =>
  viewer.permissions.includes("team:insights") ||
  viewer.permissions.includes("sprint:manage");

/** Where this viewer belongs (R4). */
export async function homeOf(
  ctx: QueryCtx,
  viewer: Viewer,
  known?: Doc<"teams"> | null,
): Promise<string> {
  if (!isManager(viewer)) return "/me";
  const team =
    known === undefined ? await currentTeam(ctx, viewer.org._id) : known;
  return team?.savedAt === undefined ? "/setup/team" : "/manager";
}

const link = (label: string, href: string, icon: Icon) => ({
  label,
  href,
  icon,
});

const MANAGER_NAV = [
  {
    title: "Team",
    links: [
      link("Overview", "/manager", "Dashboard"),
      link("Sprint", "/manager/sprint/launch", "Calendar"),
      link("Team agreement", "/manager/agreement", "DocumentTasks"),
      link("Outcomes", "/manager/outcomes", "ChartColumn"),
    ],
  },
  {
    title: "You",
    links: [
      link("My learning", "/manager/learning", "Education"),
      link("Resources", "/manager#resources", "Catalog"),
    ],
  },
];

const EMPLOYEE_NAV = [
  {
    title: null,
    links: [
      link("This week", "/me", "Home"),
      link("My sprint", "/me/sprint", "Calendar"),
      link("Work project", "/me/project", "Portfolio"),
      link("Show and tell", "/me/show-and-tell", "PresentationFile"),
      link("Credential", "/me/credential", "Certificate"),
      link("Team agreement", "/me/agreement", "DocumentTasks"),
    ],
  },
];

async function agreementSaved(ctx: QueryCtx, team: Doc<"teams">) {
  // ponytail: every version of one team's agreement, a handful of rows.
  const versions = await ctx.db
    .query("agreements")
    .withIndex("by_team_and_version", (q) => q.eq("teamId", team._id))
    .collect();
  return versions.some((a) => a.status === "saved");
}

/** The 03 steps, until launch. The first step not done is current. */
async function checklistOf(
  ctx: QueryCtx,
  viewer: Viewer,
  team: Doc<"teams"> | null,
  sprint: Doc<"sprints"> | null,
): Promise<Shell["checklist"]> {
  if (!isManager(viewer) || sprint?.launchedAt !== undefined) return null;
  const done = [
    team?.savedAt !== undefined,
    sprint?.committedAt !== undefined,
    await requiredDone(ctx, viewer.person._id),
    team !== null && (await agreementSaved(ctx, team)),
    false, // Invite team is done when the sprint launches, and then the list goes.
  ];
  const current = done.indexOf(false);
  return {
    title: "Sprint setup",
    items: SETUP_STEPS.map(({ label, href }, i) => ({
      label,
      href,
      state: done[i]
        ? ("done" as const)
        : i === current
          ? ("current" as const)
          : ("todo" as const),
    })),
  };
}

function greetingOf(viewer: Viewer, now: number): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: viewer.person.timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${viewer.person.name.split(/\s+/)[0]}`;
}

/** Priya and Dan switch to each other, once the other has a seat (spec 6). */
async function switchToOf(ctx: QueryCtx, viewer: Viewer, isDemo: boolean) {
  if (!isDemo) return null;
  const priya = castOf("priya");
  const dan = castOf("dan");
  const other =
    viewer.person.email === priya.email
      ? dan
      : viewer.person.email === dan.email
        ? priya
        : null;
  if (!other) return null;
  const people = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", viewer.org._id))
    .take(MAX_MEMBERS_PER_ORG);
  if (!people.some((p) => p.email === other.email)) return null;
  return {
    label: `Switch to ${other.name.split(" ")[0]}'s view`,
    email: other.email,
  };
}

export async function shellOf(ctx: QueryCtx, viewer: Viewer): Promise<Shell> {
  // `now` is a getter that reads the clock; read it once.
  const now = viewer.now;
  const manager = isManager(viewer);
  const isDemo = viewer.org.isDemo && flagOn("demo");
  const [team, sprint] = await Promise.all([
    currentTeam(ctx, viewer.org._id),
    currentSprint(ctx, viewer.org._id),
  ]);
  const workspaces: Shell["workspaces"] = [];
  for (const seat of await seatsOfUser(ctx, viewer.userId)) {
    const org = await ctx.db.get(seat.orgId);
    if (org)
      workspaces.push({
        id: org._id,
        name: org.name,
        current: org._id === viewer.org._id,
      });
  }
  return {
    expectOrgId: viewer.org._id,
    isDemo,
    area: manager ? "manager" : "employee",
    home: await homeOf(ctx, viewer, team),
    greeting: greetingOf(viewer, now),
    user: {
      name: viewer.person.name,
      initials: viewer.person.initials,
      role: viewer.person.jobTitle || viewer.role.name,
    },
    org: {
      name: viewer.org.name,
      initials: initialsOf(viewer.org.name),
      team: team?.name ?? "",
    },
    workspaces,
    nav: manager ? MANAGER_NAV : EMPLOYEE_NAV,
    checklist: await checklistOf(ctx, viewer, team, sprint),
    status: sprint ? sprintStatus(sprint, now, manager) : null,
    switchTo: await switchToOf(ctx, viewer, isDemo),
  };
}
