import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { getAccount, getCareer, requireCareer } from "../../convex/lib/viewer";
import {
  addCareer,
  calderLane,
  clock,
  harness,
  workspace,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test("no track sends home to /start, and the shell has only the account", async () => {
  const loner = harness().withIdentity({ subject: "user_loner" });
  expect(await loner.query(api.viewer.home, {})).toBe("/start");
  expect(await loner.query(api.viewer.shell, {})).toEqual({
    account: { name: "", initials: "?" },
  });
});

test("career only goes to /careers/journey", async () => {
  const loner = harness().withIdentity({ subject: "user_loner" });
  await addCareer(loner);
  expect(await loner.query(api.viewer.home, {})).toBe("/careers/journey");
  const shell = await loner.query(api.viewer.shell, {});
  expect(shell?.team).toBeUndefined();
  expect(shell?.career).toEqual({ private: true });
});

test("a team seat and a learner profile go to /home", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t, "Aster Network");
  await addCareer(owner);
  expect(await owner.query(api.viewer.home, {})).toBe("/home");
  const shell = await owner.query(api.viewer.shell, {});
  expect(shell?.team?.expectOrgId).toBe(orgId);
  expect(shell?.career).toEqual({ private: true });
});

test("a guide profile is not a track", async () => {
  const t = harness();
  const loner = t.withIdentity({ subject: "user_loner" });
  await addCareer(loner, "guide");
  expect(await loner.query(api.viewer.home, {})).toBe("/start");
  expect((await loner.query(api.viewer.shell, {}))?.career).toBeUndefined();
  const { owner } = await workspace(t, "Aster Network");
  const teamHome = await owner.query(api.viewer.home, {});
  await addCareer(owner, "guide");
  expect(await owner.query(api.viewer.home, {})).toBe(teamHome);
});

test("getAccount, getCareer and requireCareer", async () => {
  const t = harness();
  await expect(t.run((ctx) => getAccount(ctx))).rejects.toMatchObject({
    data: { code: "NOT_SIGNED_IN" },
  });
  const loner = t.withIdentity({ subject: "user_loner" });
  expect(await loner.run((ctx) => getCareer(ctx))).toBeNull();
  await expect(loner.run((ctx) => requireCareer(ctx))).rejects.toMatchObject({
    data: { code: "NO_CAREER_TRACK" },
  });
  await addCareer(loner, "guide");
  expect((await loner.run((ctx) => requireCareer(ctx))).profile.kind).toBe(
    "guide",
  );
  expect((await loner.run((ctx) => getAccount(ctx))).career).toBeUndefined();
});

test("two learner tracks list both rows", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2");
  await addCareer(as("dan"));
  expect((await as("dan").query(api.viewer.shell, {}))?.switcher).toEqual([
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
  ]);
});

test("the team caption is the workspace alone outside an active sprint", async () => {
  const { t, as } = await calderLane();
  await clock(t, "setup");
  await addCareer(as("priya"), "learner", false);
  const captions = async () =>
    (await as("priya").query(api.viewer.shell, {}))?.switcher?.map(
      (r) => r.caption,
    );
  expect(await captions()).toEqual(["Calder Lane", "Change careers"]);
  await clock(t, "complete");
  expect(await captions()).toEqual(["Calder Lane", "Change careers"]);
});

test("a guide profile beside a seat shows no switcher", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2");
  await addCareer(as("dan"), "guide");
  expect(
    (await as("dan").query(api.viewer.shell, {}))?.switcher,
  ).toBeUndefined();
});

test("one track shows no switcher", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2");
  expect(
    (await as("dan").query(api.viewer.shell, {}))?.switcher,
  ).toBeUndefined();
  const loner = t.withIdentity({ subject: "user_loner" });
  await addCareer(loner);
  expect((await loner.query(api.viewer.shell, {}))?.switcher).toBeUndefined();
});
