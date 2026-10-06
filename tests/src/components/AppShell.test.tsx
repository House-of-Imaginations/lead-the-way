// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { Shell } from "../../../convex/lib/shell";
import { AppShell, useShell } from "../../../src/components/app/AppShell";
import { useExpectOrgId } from "../../../src/components/app/ExpectOrgId";

let live: Shell | undefined;
vi.mock("convex-helpers/react/cache", () => ({ useQuery: () => live }));
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
  workspaces: [],
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
});

test("a switch in another tab keeps the page's workspace and says so", () => {
  live = { ...shell, expectOrgId: "other" } as Shell;
  const html = render();
  expect(html).toContain("id:org1");
  expect(html).toContain("You switched workspace in another tab");
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
