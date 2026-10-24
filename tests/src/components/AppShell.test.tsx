// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { AccountShell, Shell, TrackRow } from "../../../convex/lib/shell";
import {
  AppShell,
  useShell,
  useWorkspaceSwitched,
  workspaceGone,
} from "../../../src/components/app/AppShell";
import { useExpectOrgId } from "../../../src/components/app/ExpectOrgId";

let live: Shell | undefined;
/** The whole live `viewer.shell` (null once signed out), when a test needs more than its `team`. */
let account: AccountShell | null | undefined;
vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => (account !== undefined ? account : live && { team: live }),
}));
vi.mock("convex/react", () => ({
  useConvex: () => ({}),
  useMutation: () => vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/lib/account/auth-client", () => ({ authClient: {} }));

const shell = {
  expectOrgId: "org1",
  workspaceSettings: { open: false, owner: null, tabs: [] },
  home: "/home",
  area: "employee",
  org: { name: "Calder Lane" },
  nav: [],
  // The account holds both, so a live shell for "other" is a switch, not a loss.
  workspaces: [
    { id: "org1", name: "Calder Lane", current: true },
    { id: "other", name: "Other", current: false },
  ],
  user: { name: "Dan", email: "dan@example.com" },
  status: null,
  checklist: null,
  switchTo: null,
} as unknown as Shell;

const Probe = () => <i>id:{useExpectOrgId()}</i>;
const render = () =>
  renderToStaticMarkup(
    <AppShell initial={shell} hour={0} navState={null}>
      <Probe />
    </AppShell>,
  );

beforeEach(() => {
  live = undefined;
  account = undefined;
});

test("a switch in another tab keeps the page's workspace and says so", () => {
  live = { ...shell, expectOrgId: "other" } as Shell;
  const html = render();
  expect(html).toContain("id:org1");
  expect(html).toContain("You switched workspace in another tab");
});

test("a demo page left stale by another tab says so and drops the clock", () => {
  live = { ...shell, isDemo: true, expectOrgId: "other" } as Shell;
  const html = renderToStaticMarkup(
    <AppShell initial={{ ...shell, isDemo: true }} hour={0} navState={null}>
      <Probe />
    </AppShell>,
  );
  expect(html).toContain("The demo changed in another tab");
  expect(html).not.toContain("Demo clock");
});

test("the same workspace shows no notice", () => {
  live = shell;
  const html = render();
  expect(html).toContain("id:org1");
  expect(html).not.toContain("another tab");
});

test("two links to the same page mark only the first as current", () => {
  // After launch, Sprint opens the overview: both links go to one page.
  live = {
    ...shell,
    nav: [
      {
        title: "Team",
        links: [
          { label: "Overview", href: "/home", icon: "Dashboard" },
          { label: "Sprint", href: "/home", icon: "Calendar" },
        ],
      },
    ],
  } as Shell;
  const html = render();
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(html).toMatch(/aria-current="page"[^>]*>(?:(?!<\/a>).)*Overview/);
});

test("useExpectOrgId needs a provider", () => {
  expect(() => renderToStaticMarkup(<Probe />)).toThrow(
    "useExpectOrgId needs a workspace page above it.",
  );
});

test("useShell is the live shell, or the page's own after a switch elsewhere", () => {
  const Name = () => <b>org:{useShell().org.name}</b>;
  const renderName = () =>
    renderToStaticMarkup(
      <AppShell initial={shell} hour={0} navState={null}>
        <Name />
      </AppShell>,
    );
  live = { ...shell, org: { name: "Renamed" } } as Shell;
  expect(renderName()).toContain("org:Renamed");
  live = { ...shell, expectOrgId: "other", org: { name: "Other" } } as Shell;
  expect(renderName()).toContain("org:Calder Lane");
});

test("useShell needs AppShell above it", () => {
  const Name = () => <b>{useShell().org.name}</b>;
  expect(() => renderToStaticMarkup(<Name />)).toThrow(
    "useShell needs AppShell above it.",
  );
});

test("a live shell with no team keeps the server's shell while /home loads (R8)", () => {
  account = { account: { name: "Dan", initials: "D" } };
  const html = render();
  expect(html).toContain("id:org1");
  expect(html).toContain("Calder Lane");
  expect(html).not.toContain("another tab");
});

test("the workspace is gone only once the live shell no longer lists it (R8)", () => {
  const me = { name: "Dan", initials: "D" };
  const other = { ...shell, expectOrgId: "other" } as Shell;
  const without = {
    ...other,
    workspaces: [{ id: "other", name: "Other", current: true }],
  } as Shell;
  // Loading or signed out: the server's copy stays.
  expect(workspaceGone(undefined, shell.expectOrgId)).toBe(false);
  expect(workspaceGone(null, shell.expectOrgId)).toBe(false);
  // Still held: the same workspace, or a switch in another tab.
  expect(workspaceGone({ account: me, team: shell }, "org1" as never)).toBe(
    false,
  );
  expect(workspaceGone({ account: me, team: other }, "org1" as never)).toBe(
    false,
  );
  // Deleted, left or lost: no seat at all, or the next seat without it.
  expect(workspaceGone({ account: me }, "org1" as never)).toBe(true);
  expect(workspaceGone({ account: me, team: without }, "org1" as never)).toBe(
    true,
  );
});

test("a deleted workspace with another seat left never says it switched (R8)", () => {
  const Stale = () => <u>stale:{String(useWorkspaceSwitched())}</u>;
  account = {
    account: { name: "Dan", initials: "D" },
    team: {
      ...shell,
      expectOrgId: "other",
      org: { name: "Other" },
      workspaces: [{ id: "other", name: "Other", current: true }],
    } as Shell,
  };
  const html = renderToStaticMarkup(
    <AppShell initial={shell} hour={0} navState={null}>
      <Stale />
    </AppShell>,
  );
  expect(html).not.toContain("another tab");
  // The page's own workspace stays on screen and its live queries stop.
  expect(html).toContain("Calder Lane");
  expect(html).toContain("stale:true");
});

const rows: TrackRow[] = [
  {
    kind: "team",
    name: "Team sprint",
    caption: "Calder Lane, week 2 of 4",
    initials: "CL",
    private: false,
    href: "/me",
  },
  {
    kind: "career",
    name: "Change careers",
    caption: "Private",
    private: true,
    href: "/careers/journey",
  },
];

test("two tracks: the switcher replaces the org block", () => {
  const html = renderToStaticMarkup(
    <AppShell initial={shell} hour={0} navState={null} switcher={rows}>
      <Probe />
    </AppShell>,
  );
  for (const text of [
    "Your tracks",
    "Team sprint",
    "Change careers",
    "Two tracks",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).not.toContain("ltw-sn-org");
});

test("one track: the org block stays", () => {
  const html = render();
  expect(html).toContain("ltw-sn-org");
  expect(html).not.toContain("Your tracks");
});

const renderRows = (switcher?: TrackRow[]) =>
  renderToStaticMarkup(
    <AppShell initial={shell} hour={0} navState={null} switcher={switcher}>
      <Probe />
    </AppShell>,
  );
const me = { name: "Dan", initials: "D" };

test("the live rows win over the server's copy", () => {
  account = { account: me, team: shell, switcher: rows };
  expect(renderRows()).toContain("Your tracks");
  account = { account: me, team: shell };
  expect(renderRows(rows)).not.toContain("Your tracks");
});

test("signed out, the server's rows stay", () => {
  account = null;
  expect(renderRows(rows)).toContain("Your tracks");
});

test("after a switch in another tab, the server's rows stay", () => {
  account = {
    account: me,
    team: { ...shell, expectOrgId: "other" } as Shell,
  };
  const html = renderRows(rows);
  expect(html).toContain("Your tracks");
  expect(html).toContain("You switched workspace in another tab");
});
