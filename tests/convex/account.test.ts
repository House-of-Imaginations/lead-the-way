import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  getAccount,
  getCareer,
  requireCareer,
  requireTeam,
} from "../../convex/lib/viewer";
import { addCareer, harness, workspace } from "./workspace/helpers";

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

test("getAccount, getCareer, requireCareer and requireTeam", async () => {
  const t = harness();
  await expect(t.run((ctx) => getAccount(ctx))).rejects.toMatchObject({
    data: { code: "NOT_SIGNED_IN" },
  });
  const loner = t.withIdentity({ subject: "user_loner" });
  expect(await loner.run((ctx) => getCareer(ctx))).toBeNull();
  await expect(loner.run((ctx) => requireCareer(ctx))).rejects.toMatchObject({
    data: { code: "NO_CAREER_TRACK" },
  });
  await expect(loner.run((ctx) => requireTeam(ctx))).rejects.toMatchObject({
    data: { code: "NO_WORKSPACE" },
  });
  await addCareer(loner, "guide");
  expect((await loner.run((ctx) => requireCareer(ctx))).profile.kind).toBe(
    "guide",
  );
  expect((await loner.run((ctx) => getAccount(ctx))).career).toBeUndefined();
});
