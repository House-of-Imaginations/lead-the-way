// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { MembersTab } from "../../../src/app/(app)/workspace/settings/_components/MembersTab";
import { WorkspaceSettings } from "../../../src/app/(app)/workspace/settings/_components/WorkspaceSettings";

let liveTabs: string[] = [];
const useQuery = vi.fn<(...args: unknown[]) => unknown>();
vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
}));
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  usePreloadedQuery: () => ({}),
}));
vi.mock("@/components/app/AppShell", () => ({
  useShell: () => ({
    org: { name: "Calder Lane", team: "" },
    workspaceSettings: { open: true, owner: null, tabs: liveTabs },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({
  ToastProvider: ({ children }: { children: unknown }) => children,
  useToast: () => vi.fn(),
}));
vi.mock("@/components/app/ExpectOrgId", () => ({
  useExpectOrgId: () => "org1",
}));
vi.mock(
  "../../../src/app/(app)/workspace/settings/_components/GeneralTab",
  () => ({ GeneralTab: () => <i>general-body</i> }),
);
vi.mock(
  "../../../src/app/(app)/workspace/settings/_components/SprintDefaultsTab",
  () => ({ SprintDefaultsTab: () => <i>sprint-body</i> }),
);
vi.mock(
  "../../../src/app/(app)/workspace/settings/_components/PrivacyTab",
  () => ({ PrivacyTab: () => <i>privacy-body</i> }),
);

const members = { people: [], invites: [], roles: [] };
const preloaded = {} as never;
const render = (tabs: ("general" | "members")[]) =>
  renderToStaticMarkup(
    <WorkspaceSettings
      tabs={tabs}
      settings={tabs.includes("general") ? preloaded : null}
      members={tabs.includes("members") ? members : null}
    />,
  );

beforeEach(() => {
  useQuery.mockClear();
});

test("a seat with only members:manage sees only the Members tab", () => {
  liveTabs = ["members"];
  const html = render(["members"]);
  expect(html).toContain(">Members<");
  expect(html).not.toContain(">General<");
  expect(html).not.toContain(">Data and privacy<");
});

test("a live shell without members hides the tab and runs no member query", () => {
  liveTabs = ["general"];
  // The page was rendered while the seat still held members:manage.
  const html = render(["general", "members"]);
  expect(html).toContain(">General<");
  expect(html).not.toContain(">Members<");
  expect(useQuery).not.toHaveBeenCalled();
});

test("Members skips its queries once the live shell drops the permission", () => {
  liveTabs = ["general"];
  renderToStaticMarkup(<MembersTab initial={members} />);
  expect(useQuery).toHaveBeenCalled();
  for (const call of useQuery.mock.calls) expect(call[1]).toBe("skip");
});

test("Members subscribes while the live shell lists members", () => {
  liveTabs = ["members"];
  renderToStaticMarkup(<MembersTab initial={members} />);
  expect(useQuery).toHaveBeenCalled();
  for (const call of useQuery.mock.calls) expect(call[1]).not.toBe("skip");
});
