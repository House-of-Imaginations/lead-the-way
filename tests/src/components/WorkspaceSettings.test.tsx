// @vitest-environment node
import { getFunctionName } from "convex/server";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { MembersTab } from "../../../src/app/(app)/workspace/settings/_components/MembersTab";
import { WorkspaceSettings } from "../../../src/app/(app)/workspace/settings/_components/WorkspaceSettings";

let liveTabs: string[] = [];
let switched = false;
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
  useWorkspaceSwitched: () => switched,
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
  () => ({
    GeneralTab: ({ data }: { data: { orgId: string } }) => (
      <i>{`general-body ${data.orgId}`}</i>
    ),
  }),
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
const settings = (orgId: string) => ({ orgId }) as never;
const render = (tabs: ("general" | "members")[], from = "org1") =>
  renderToStaticMarkup(
    <WorkspaceSettings
      tabs={tabs}
      settings={tabs.includes("general") ? settings(from) : null}
      members={tabs.includes("members") ? members : null}
    />,
  );
const calls = (name: string) =>
  useQuery.mock.calls.filter((c) => getFunctionName(c[0] as never) === name);

beforeEach(() => {
  useQuery.mockClear();
  switched = false;
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
  // General's own read runs; nothing reads members.
  expect(calls("members:list")).toEqual([]);
});

test("Members skips its queries once the live shell drops the permission", () => {
  liveTabs = ["general"];
  renderToStaticMarkup(<MembersTab initial={members} />);
  expect(useQuery).toHaveBeenCalled();
  for (const call of useQuery.mock.calls) expect(call[1]).toBe("skip");
});

test("Members keeps its own workspace's rows after a switch in another tab (C2)", () => {
  liveTabs = ["members"];
  switched = true;
  const html = renderToStaticMarkup(
    <MembersTab
      initial={{
        ...members,
        people: [
          {
            orgId: "org1",
            personId: "p1",
            name: "Priya Raman",
            email: "priya@example.com",
            roleId: "r1",
            roleName: "Owner",
          } as never,
        ],
      }}
    />,
  );
  // The live queries would answer for the other workspace: none run.
  expect(useQuery).toHaveBeenCalled();
  for (const call of useQuery.mock.calls) expect(call[1]).toBe("skip");
  expect(html).toContain("Priya Raman");
});

const person = (orgId: string, name: string) =>
  ({
    orgId,
    personId: `p-${name}`,
    name,
    email: `${name}@example.com`,
    roleId: "r1",
    roleName: "Employee",
  }) as never;

test("Members never renders another workspace's rows read during a switch (C2)", () => {
  liveTabs = ["members"];
  // The server read the lists after a switch in another tab: org2's rows.
  const html = renderToStaticMarkup(
    <MembersTab
      initial={{ ...members, people: [person("org2", "Other Person")] }}
    />,
  );
  expect(html).not.toContain("Other Person");
  // A live answer from org2 keeps the page's own rows.
  useQuery.mockReturnValue([person("org2", "Other Live")]);
  const live = renderToStaticMarkup(
    <MembersTab initial={{ ...members, people: [person("org1", "Own")] }} />,
  );
  useQuery.mockReset();
  expect(live).not.toContain("Other Live");
  expect(live).toContain("Own");
});

test("General keeps its own workspace's settings after a switch (R-g)", () => {
  liveTabs = ["general"];
  switched = true;
  const html = render(["general"]);
  // The live read would answer for the other workspace: it doesn't run.
  expect(calls("workspace:settings").map((c) => c[1])).toEqual(["skip"]);
  expect(html).toContain("general-body org1");
});

test("General never shows another workspace's settings (R-g)", () => {
  liveTabs = ["general"];
  // The server read them after a switch in another tab.
  expect(render(["general"], "org2")).not.toContain("general-body");
  // A live answer from org2 keeps the page's own.
  useQuery.mockReturnValue(settings("org2"));
  const live = render(["general"]);
  useQuery.mockReset();
  expect(live).toContain("general-body org1");
});

test("Members subscribes while the live shell lists members", () => {
  liveTabs = ["members"];
  renderToStaticMarkup(<MembersTab initial={members} />);
  expect(useQuery).toHaveBeenCalled();
  for (const call of useQuery.mock.calls) expect(call[1]).not.toBe("skip");
});
