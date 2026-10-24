import { expect, test } from "vitest";
import { startHrefs, startReady } from "@/app/start/_components/startHrefs";

test.each([
  [
    { signedIn: false, team: false, career: false },
    { lead: "/signup?track=team", career: "/careers/map/new" },
  ],
  [
    { signedIn: true, team: false, career: false },
    { lead: "/setup/start", career: "/careers/map/new" },
  ],
  [
    { signedIn: true, team: true, career: false },
    { lead: "/home", career: "/tracks/private/new" },
  ],
  [
    { signedIn: true, team: false, career: true },
    { lead: "/setup/start", career: "/home" },
  ],
  [
    { signedIn: true, team: true, career: true },
    { lead: "/home", career: "/home" },
  ],
])("startHrefs(%o)", (state, hrefs) =>
  expect(startHrefs(state)).toEqual(hrefs),
);

const out = { signedIn: false, team: false, career: false };
const none = { signedIn: true, team: false, career: false };
const team = { signedIn: true, team: true, career: false };
const career = { signedIn: true, team: false, career: true };
const both = { signedIn: true, team: true, career: true };

test.each([
  [out, null, null, null],
  [out, "team", null, null],
  [out, "team", "invited", null],
  [out, "team", "lead", { label: "Set up team", href: "/signup?track=team" }],
  [out, "career", null, { label: "Start my map", href: "/careers/map/new" }],
  [none, "team", "lead", { label: "Set up team", href: "/setup/start" }],
  // A team account never sees the way in, whatever it picked before.
  [team, "team", null, { label: "Continue", href: "/home" }],
  [team, "team", "invited", { label: "Continue", href: "/home" }],
  [
    team,
    "career",
    null,
    { label: "Start my map", href: "/tracks/private/new" },
  ],
  [career, "career", null, { label: "Continue", href: "/home" }],
  [career, "team", "invited", null],
  [career, "team", "lead", { label: "Set up team", href: "/setup/start" }],
  [both, "team", null, { label: "Continue", href: "/home" }],
  [both, "career", null, { label: "Continue", href: "/home" }],
] as const)("startReady(%o, %s, %s)", (state, track, way, ready) =>
  expect(startReady(state, track, way)).toEqual(ready),
);
