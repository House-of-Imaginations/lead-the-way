import { literals } from "convex-helpers/validators";
import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { flagOn } from "../app";
import { castOf } from "./demo/cast";
import { MAX_MEMBERS_PER_ORG, seatsOfUser } from "./orgs/membership";
import {
  ROUTE_PERMISSION,
  isManager,
  type ManagerRoute,
  type Permission,
} from "./orgs/permissions";
import { firstNameOf, initialsOf } from "./orgs/people";
import { settingsOf } from "./settings";
import { SETUP_STEPS } from "./setupSteps";
import { setupSprint, currentTeam, launchedSprint, setupGate } from "./sprint";
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
  /** The person's Reduce motion setting (P7b-1); AppShell sets `data-reduce-motion`. */
  reduceMotion: v.boolean(),
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

/**
 * Where this viewer belongs (R4). Launch doesn't need the team profile, and
 * setup closes at launch, so a launched sprint is home at /manager either way.
 */
export async function homeOf(
  ctx: QueryCtx,
  viewer: Viewer,
  known?: { team: Doc<"teams"> | null; sprint: Doc<"sprints"> | null },
): Promise<string> {
  if (!isManager(viewer)) return "/me";
  const orgId = viewer.org._id;
  const { team, sprint } = known ?? {
    team: await currentTeam(ctx, orgId),
    sprint: await setupSprint(ctx, orgId),
  };
  return team?.savedAt === undefined && sprint?.launchedAt === undefined
    ? "/setup/team"
    : "/manager";
}

const link = (label: string, href: string, icon: Icon) => ({
  label,
  href,
  icon,
});

type Link = ReturnType<typeof link>;

/** A manager page's link, carrying the permission its query needs (Ruling 5). */
const page = (label: string, href: ManagerRoute, icon: Icon) => ({
  ...link(label, href, icon),
  need: ROUTE_PERMISSION[href] as Permission | null,
});

/**
 * Ruling 13: a link with a `need` shows only to a viewer who holds it. Overview
 * and Resources have none, so every manager has a home and the resources.
 */
const MANAGER_NAV: {
  title: string;
  links: (Link & { need?: Permission | null })[];
}[] = [
  {
    title: "Team",
    links: [
      page("Overview", "/manager", "Dashboard"),
      page("Sprint", "/manager/sprint/launch", "Calendar"),
      page("Team agreement", "/manager/agreement", "DocumentTasks"),
      page("Outcomes", "/manager/outcomes", "ChartColumn"),
    ],
  },
  {
    title: "You",
    links: [
      page("My learning", "/manager/learning", "Education"),
      link("Resources", "/manager#resources", "Catalog"),
    ],
  },
];

/**
 * Once the sprint launches, Sprint opens the overview (spec 4.1). Matched by
 * href, and it keeps the launch page's `need`, so it still shows only to
 * `sprint:manage`.
 */
const LAUNCHED_NAV = MANAGER_NAV.map((group) => ({
  ...group,
  links: group.links.map((l) =>
    l.href === "/manager/sprint/launch" ? { ...l, href: "/manager" } : l,
  ),
}));

/** The links this viewer may open, without `need` (the validator has no such field). */
function navFor(viewer: Viewer, groups: typeof MANAGER_NAV): Shell["nav"] {
  return groups
    .map((group) => ({
      title: group.title,
      links: group.links
        .filter((l) => !l.need || viewer.permissions.includes(l.need))
        .map(({ label, href, icon }) => ({ label, href, icon })),
    }))
    .filter((group) => group.links.length > 0);
}

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

/** The 03 steps, until launch. The first step not done is current. */
async function checklistOf(
  ctx: QueryCtx,
  viewer: Viewer,
  team: Doc<"teams"> | null,
  sprint: Doc<"sprints"> | null,
): Promise<Shell["checklist"]> {
  // Without sprint:manage every step's page would send them back to /manager.
  if (
    !viewer.permissions.includes("sprint:manage") ||
    sprint?.launchedAt !== undefined
  ) {
    return null;
  }
  const gate = await setupGate(ctx, viewer, team, sprint);
  const done = [
    gate.teamSaved,
    gate.committed,
    gate.pathwayDone,
    gate.agreementSaved,
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

/** Ruling 23 (P6): in the viewer's own time zone, afternoon ends at 5:00 PM. 11 uses it too. */
export function greetingOf(viewer: Viewer, now: number): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: viewer.person.timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${firstNameOf(viewer.person.name)}`;
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
    label: `Switch to ${firstNameOf(other.name)}'s view`,
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
    setupSprint(ctx, viewer.org._id),
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
  // A manager's status follows setup, so a clone shows as the draft it is. An
  // employee's stays on the launched sprint (P7a Ruling 15).
  const shown = manager ? sprint : await launchedSprint(ctx, viewer.org._id);
  return {
    expectOrgId: viewer.org._id,
    isDemo,
    reduceMotion: (await settingsOf(ctx, viewer.person._id)).reduceMotion,
    area: manager ? "manager" : "employee",
    home: await homeOf(ctx, viewer, { team, sprint }),
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
    nav: manager
      ? navFor(
          viewer,
          sprint?.launchedAt === undefined ? MANAGER_NAV : LAUNCHED_NAV,
        )
      : EMPLOYEE_NAV,
    checklist: await checklistOf(ctx, viewer, team, sprint),
    status: shown ? sprintStatus(shown, now, manager) : null,
    switchTo: await switchToOf(ctx, viewer, isDemo),
  };
}
