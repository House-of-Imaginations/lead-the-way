// @vitest-environment node
import { expect, test } from "vitest";
import {
  copyLinks,
  launchedToast,
  sendReason,
} from "../../../src/app/(app)/manager/sprint/launch/LaunchForm";

const link = (email: string, token: string) => ({ email, token });

test("a role without members:manage is told who can send", () => {
  const gate = { committed: true, pathwayDone: true, agreementSaved: true };
  expect(sendReason({ canInvite: false, carriesTeam: false, gate }, 2)).toBe(
    "Ask a workspace admin to send invitations.",
  );
  expect(
    sendReason({ canInvite: true, carriesTeam: false, gate }, 2),
  ).toBeNull();
  expect(sendReason({ canInvite: true, carriesTeam: false, gate }, 0)).toBe(
    "Add at least one email address.",
  );
  expect(
    sendReason(
      {
        canInvite: true,
        carriesTeam: false,
        gate: { ...gate, pathwayDone: false },
      },
      2,
    ),
  ).toBe("Protect the hour, finish the pathway and save the agreement first.");
});

test("a later sprint may send with no new addresses", () => {
  const gate = { committed: true, pathwayDone: true, agreementSaved: true };
  expect(
    sendReason({ canInvite: true, carriesTeam: true, gate }, 0),
  ).toBeNull();
});

test("links launch returned are kept when launchPage has none (email on)", () => {
  const links = copyLinks(null, [link("a@calderlane.com.au", "t1")]);
  expect(links.get("a@calderlane.com.au")).toBe("t1");
});

test("launchPage links and launch's links merge", () => {
  const links = copyLinks(
    [link("a@example.com", "t1")],
    [link("b@example.com", "t2")],
  );
  expect([...links]).toEqual([
    ["a@example.com", "t1"],
    ["b@example.com", "t2"],
  ]);
});

test("the toast says sent only when every invitation was emailed", () => {
  expect(launchedToast({ invited: 3, emailed: 3 })).toEqual({
    title: "Sprint launched",
    body: "3 invitations sent.",
  });
  expect(launchedToast({ invited: 3, emailed: 2 })).toEqual({
    title: "Sprint launched",
    body: "3 invitations ready. Copy each link below.",
  });
  expect(launchedToast({ invited: 1, emailed: 0 })).toEqual({
    title: "Sprint launched",
    body: "1 invitation ready. Copy each link below.",
  });
});

test("the toast says so when everyone was already invited", () => {
  expect(launchedToast({ invited: 0, emailed: 0 })).toEqual({
    title: "Sprint launched",
    body: "Everyone is already invited.",
  });
});
