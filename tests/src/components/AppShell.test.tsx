// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import type { Shell } from "../../../convex/lib/shell";
import { AppShell, useExpectOrgId } from "../../../src/components/app/AppShell";

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
    <AppShell initial={shell} navState={null}>
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
