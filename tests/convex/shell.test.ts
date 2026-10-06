import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  DEMO_TARGETS,
  mel,
  type DemoTarget,
} from "../../convex/lib/demo/schedule";
import { DEFAULT_SETTINGS } from "../../convex/lib/settings";
import type { Shell } from "../../convex/lib/shell";
import { personOf } from "./sprintHelpers";
import {
  calderLane,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function clock(t: T, target: DemoTarget) {
  await t.mutation(internal.seed.clock, { target });
}

const next = (value: string) => ({
  label: "Next protected hour",
  value,
  note: null,
});

// Spec 7.1, "Weeks 1, 3, 4 and complete", and R3's before-launch variant.
const PRIYA_STATUS: Record<DemoTarget, unknown> = {
  setup: {
    heading: null,
    progress: null,
    label: "Sprint starts",
    value: "Wed 9 Sep, 2:00 PM",
    note: null,
  },
  week1: {
    heading: "Week 1 of 4",
    progress: { value: 1, max: 4 },
    ...next("Wed 9 Sep, 2:00 PM"),
  },
  week2: {
    heading: "Week 2 of 4",
    progress: { value: 2, max: 4 },
    ...next("Wed 16 Sep, 2:00 PM"),
  },
  week3: {
    heading: "Week 3 of 4",
    progress: { value: 3, max: 4 },
    ...next("Wed 23 Sep, 2:00 PM"),
  },
  week4: {
    heading: "Week 4 of 4",
    progress: { value: 4, max: 4 },
    label: "Show and tell",
    value: "Wed 30 Sep, 2:00 PM",
    note: null,
  },
  complete: {
    heading: null,
    progress: null,
    label: "Sprint complete",
    value: "9 to 30 September 2026",
    note: null,
  },
};

test("Priya's status reads right at every demo target", async () => {
  const { t, as } = await calderLane();
  for (const target of Object.keys(DEMO_TARGETS) as DemoTarget[]) {
    if (target !== "setup") await clock(t, target);
    const shell = await as("priya").query(api.viewer.shell, {});
    expect(shell?.status, target).toEqual(PRIYA_STATUS[target]);
  }
});

test("a launched sprint says when it starts until week one's Monday", async () => {
  const { t, orgId, as } = await calderLane();
  await t.run(async (ctx) => {
    const sprint = await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    await ctx.db.patch(sprint!._id, { launchedAt: DEMO_TARGETS.setup });
  });
  const statusAt = async (local: string) => {
    await t.run((ctx) => ctx.db.patch(orgId, { demoNow: mel(local) }));
    return (await as("priya").query(api.viewer.shell, {}))?.status;
  };
  // Sunday 6 September, evening: launched, but week one is tomorrow.
  expect(await statusAt("2026-09-06T20:00")).toEqual(PRIYA_STATUS.setup);
  // Monday 7 September: week 1, two days before its hour.
  expect(await statusAt("2026-09-07T09:00")).toEqual(PRIYA_STATUS.week1);
});

test("Priya at setup: her home, greeting, nav and first checklist step", async () => {
  const { orgId, as } = await calderLane();
  const priya = as("priya");
  expect(await priya.query(api.viewer.home, {})).toBe("/setup/team");
  const shell = await priya.query(api.viewer.shell, {});
  expect(shell).toMatchObject({
    expectOrgId: orgId,
    isDemo: true,
    area: "manager",
    home: "/setup/team",
    greeting: "Good morning, Priya",
    user: { name: "Priya Raman", initials: "PR", role: "Team manager" },
    org: { name: "Calder Lane", initials: "CL", team: "Client Services team" },
    workspaces: [{ id: orgId, name: "Calder Lane", current: true }],
    // Dan has no seat before the team joins on 8 September (Review focus 3).
    switchTo: null,
  });
  expect(shell?.nav).toEqual([
    {
      title: "Team",
      links: [
        { label: "Overview", href: "/manager", icon: "Dashboard" },
        { label: "Sprint", href: "/manager/sprint/launch", icon: "Calendar" },
        {
          label: "Team agreement",
          href: "/manager/agreement",
          icon: "DocumentTasks",
        },
        { label: "Outcomes", href: "/manager/outcomes", icon: "ChartColumn" },
      ],
    },
    {
      title: "You",
      links: [
        { label: "My learning", href: "/manager/learning", icon: "Education" },
        { label: "Resources", href: "/manager#resources", icon: "Catalog" },
      ],
    },
  ]);
  expect(shell?.checklist).toEqual({
    title: "Sprint setup",
    items: [
      { label: "Your team", href: "/setup/team", state: "current" },
      {
        label: "Protected hour",
        href: "/setup/protected-hour",
        state: "todo",
      },
      { label: "Manager pathway", href: "/manager/learning", state: "todo" },
      { label: "Team agreement", href: "/manager/agreement", state: "todo" },
      {
        label: "Invite team",
        href: "/manager/sprint/launch",
        state: "todo",
      },
    ],
  });
});

test("the checklist follows setup and goes once the sprint launches", async () => {
  const { t, orgId, as } = await calderLane();
  const states = async () =>
    (await as("priya").query(api.viewer.shell, {}))?.checklist?.items.map(
      (i) => i.state,
    );
  await t.run(async (ctx) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    await ctx.db.patch(team!._id, { savedAt: Date.now() });
    const sprint = await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    await ctx.db.patch(sprint!._id, { committedAt: Date.now() });
  });
  expect(await states()).toEqual(["done", "done", "current", "todo", "todo"]);
  expect(await as("priya").query(api.viewer.home, {})).toBe("/manager");

  await clock(t, "week1");
  expect((await as("priya").query(api.viewer.shell, {}))?.checklist).toBeNull();
});

test("a manager without sprint:manage gets no setup checklist", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  expect((await owner.query(api.viewer.shell, {}))?.checklist).not.toBeNull();
  // Its links would only bounce them back to /manager.
  const insights = await seat(t, orgId, "user_insights", ["team:insights"]);
  expect((await insights.as.query(api.viewer.shell, {}))?.checklist).toBeNull();
});

test("home is /manager once the sprint launched, team profile or not", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  expect(await owner.query(api.viewer.home, {})).toBe("/setup/team");
  // The launch gate never asks for the team profile, so it can still be unsaved.
  await t.run(async (ctx) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    await ctx.db.insert("sprints", {
      orgId,
      teamId: team!._id,
      status: "scheduled",
      startDate: "2026-09-09",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      courseTitle: "AI Productivity Fundamentals",
      createdAt: 1,
      launchedAt: 1,
    });
  });
  expect(await owner.query(api.viewer.home, {})).toBe("/manager");
  expect((await owner.query(api.viewer.shell, {}))?.home).toBe("/manager");
});

test("switchTo waits for the other persona's seat", async () => {
  const { t, as } = await calderLane();
  expect((await as("priya").query(api.viewer.shell, {}))?.switchTo).toBeNull();
  await clock(t, "week2");
  expect((await as("priya").query(api.viewer.shell, {}))?.switchTo).toEqual({
    label: "Switch to Dan's view",
    email: "dan.okafor@calderlane.com.au",
  });
  expect((await as("dan").query(api.viewer.shell, {}))?.switchTo).toEqual({
    label: "Switch to Priya's view",
    email: "priya.raman@calderlane.com.au",
  });
  // Sarah is seeded too, but the switch is between Priya and Dan only (spec 6).
  expect((await as("sarah").query(api.viewer.shell, {}))?.switchTo).toBeNull();
});

test("Dan's shell in week 2 is the employee one", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2");
  const dan = as("dan");
  expect(await dan.query(api.viewer.home, {})).toBe("/me");
  const shell = await dan.query(api.viewer.shell, {});
  expect(shell).toMatchObject({
    area: "employee",
    home: "/me",
    greeting: "Good afternoon, Dan",
    user: {
      name: "Dan Okafor",
      initials: "DO",
      role: "Senior Account Executive",
    },
    checklist: null,
    status: {
      heading: null,
      progress: null,
      label: "Next protected hour",
      value: "Wed 16 Sep, 2:00 PM",
      note: "Your learning activity is private.",
    },
  });
  expect(shell?.nav).toEqual([
    {
      title: null,
      links: [
        { label: "This week", href: "/me", icon: "Home" },
        { label: "My sprint", href: "/me/sprint", icon: "Calendar" },
        { label: "Work project", href: "/me/project", icon: "Portfolio" },
        {
          label: "Show and tell",
          href: "/me/show-and-tell",
          icon: "PresentationFile",
        },
        { label: "Credential", href: "/me/credential", icon: "Certificate" },
        {
          label: "Team agreement",
          href: "/me/agreement",
          icon: "DocumentTasks",
        },
      ],
    },
  ]);
});

test("isDemo is false for a real workspace, and for the demo when DEMO_MODE is off", async () => {
  const { as } = await calderLane();
  const t = harness();
  const { owner } = await workspace(t);
  const real = await owner.query(api.viewer.shell, {});
  expect(real).toMatchObject({
    isDemo: false,
    switchTo: null,
    home: "/setup/team",
    org: { name: "Aster Network", team: "Your team" },
    status: null,
  });

  vi.stubEnv("DEMO_MODE", "");
  const demo = await as("priya").query(api.viewer.shell, {});
  expect(demo).toMatchObject({ isDemo: false, switchTo: null });
});

test("the area comes from permissions, not the role's name", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const cases: [
    string,
    ("team:insights" | "sprint:manage" | "members:read")[],
    string,
  ][] = [
    ["user_insights", ["team:insights"], "manager"],
    ["user_sprint", ["sprint:manage"], "manager"],
    ["user_reader", ["members:read"], "employee"],
  ];
  for (const [subject, permissions, area] of cases) {
    const { as } = await seat(t, orgId, subject, permissions);
    expect((await as.query(api.viewer.shell, {}))?.area, subject).toBe(area);
  }
});

test("signed out or with no workspace, the shell is null", async () => {
  const t = harness();
  expect(await t.query(api.viewer.shell, {})).toBeNull();
  expect(await t.query(api.viewer.home, {})).toBeNull();
  const loner = t.withIdentity({ subject: "user_loner" });
  expect(await loner.query(api.viewer.shell, {})).toBeNull();
  expect(await loner.query(api.viewer.home, {})).toBe("/setup/start");
});

test("the workspace list marks the open one", async () => {
  const t = harness();
  const a = await workspace(t, "Aster Network");
  const b = await workspace(t, "Birch Studio"); // the owner's newest is open
  const shell = await a.owner.query(api.viewer.shell, {});
  expect(shell?.expectOrgId).toBe(b.orgId);
  expect(shell?.workspaces.map((w) => [w.name, w.current]).sort()).toEqual([
    ["Aster Network", false],
    ["Birch Studio", true],
  ]);
});

const navOf = (shell: Shell | null) =>
  shell?.nav.map((group) => [group.title, group.links.map((l) => l.label)]);

test("the nav shows a manager only what their permissions open (Ruling 13)", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  // The owner holds every permission: all six.
  expect(navOf(await owner.query(api.viewer.shell, {}))).toEqual([
    ["Team", ["Overview", "Sprint", "Team agreement", "Outcomes"]],
    ["You", ["My learning", "Resources"]],
  ]);
  const insights = await seat(t, orgId, "user_insights", ["team:insights"]);
  expect(navOf(await insights.as.query(api.viewer.shell, {}))).toEqual([
    ["Team", ["Overview", "Outcomes"]],
    ["You", ["Resources"]],
  ]);
  // Review Focus 4: sprint:manage alone never sees Outcomes.
  const sprint = await seat(t, orgId, "user_sprint", ["sprint:manage"]);
  expect(navOf(await sprint.as.query(api.viewer.shell, {}))).toEqual([
    ["Team", ["Overview", "Sprint", "Team agreement"]],
    ["You", ["My learning", "Resources"]],
  ]);
});

test("the status follows the clock across the end of the hour, and accepts hour (Review Focus 3)", async () => {
  const { t, orgId, as } = await calderLane();
  await clock(t, "week2");
  // convex-test has no query cache, so this shows the status reads the clock
  // and takes `hour`, not that a new `hour` busts a cached answer.
  const statusAt = async (local: string) => {
    const now = mel(local);
    await t.run((ctx) => ctx.db.patch(orgId, { demoNow: now }));
    const shell = await as("priya").query(api.viewer.shell, {
      hour: Math.floor(now / 3_600_000),
    });
    return shell?.status;
  };
  expect(await statusAt("2026-09-16T14:30")).toEqual({
    heading: "Week 2 of 4",
    progress: { value: 2, max: 4 },
    ...next("Wed 16 Sep, 2:00 PM"),
  });
  // The hour has ended: still week 2, but the next hour is the 23rd.
  expect(await statusAt("2026-09-16T15:01")).toEqual({
    heading: "Week 2 of 4",
    progress: { value: 2, max: 4 },
    ...next("Wed 23 Sep, 2:00 PM"),
  });
});

test("once launched, Sprint opens the overview and still needs sprint:manage (Ruling 5)", async () => {
  const { t, orgId, as } = await calderLane();
  await clock(t, "week1");
  const links = (shell: Shell | null) =>
    shell?.nav.flatMap((group) => group.links.map((l) => [l.label, l.href]));
  expect(links(await as("priya").query(api.viewer.shell, {}))).toEqual([
    ["Overview", "/manager"],
    ["Sprint", "/manager"],
    ["Team agreement", "/manager/agreement"],
    ["Outcomes", "/manager/outcomes"],
    ["My learning", "/manager/learning"],
    ["Resources", "/manager#resources"],
  ]);
  const insights = await seat(t, orgId, "user_insights", ["team:insights"]);
  expect(links(await insights.as.query(api.viewer.shell, {}))).toEqual([
    ["Overview", "/manager"],
    ["Outcomes", "/manager/outcomes"],
    ["Resources", "/manager#resources"],
  ]);
});

test("the shell carries the viewer's reduce motion setting (P7b-1)", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  expect((await priya.query(api.viewer.shell, {}))?.reduceMotion).toBe(false);
  const priyaId = await personOf(t, orgId, "priya");
  await t.run((ctx) =>
    ctx.db.insert("settings", {
      orgId,
      personId: priyaId,
      ...DEFAULT_SETTINGS,
      reduceMotion: true,
    }),
  );
  expect((await priya.query(api.viewer.shell, {}))?.reduceMotion).toBe(true);
});

test("the shell opens 18 to org:manage only and names the owner to everyone else", async () => {
  const { t, orgId, as } = await calderLane();
  // Dan has no seat before the team joins.
  await clock(t, "week1");
  const { as: lead } = await seat(t, orgId, "user_lead", [
    "sprint:manage",
    "team:insights",
  ]);
  const wsOf = async (who: typeof lead) =>
    (await who.query(api.viewer.shell, {}))?.workspaceSettings;
  expect(await wsOf(as("priya"))).toEqual({
    open: true,
    owner: "Priya Raman",
  });
  for (const who of [as("dan"), lead]) {
    expect(await wsOf(who)).toEqual({
      open: false,
      owner: "Priya Raman",
    });
  }
});
