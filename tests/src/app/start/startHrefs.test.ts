import { expect, test } from "vitest";
import { startHrefs } from "@/app/start/_components/startHrefs";

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
