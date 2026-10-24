import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  addCareer,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

/**
 * C4: Delete workspace and Leave never touch the career track. X1 holds that
 * by construction (no career table has an org); these pin the behaviour, and
 * that /home's answer then is the career route.
 */
const profile = (t: T, id: Id<"careerProfiles">) =>
  t.run((ctx) => ctx.db.get(id));

test("a career profile survives Delete workspace, and home is the career route", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const career = await addCareer(owner);
  expect(await owner.query(api.viewer.home, {})).toBe("/home");

  await owner.mutation(api.orgs.remove, {
    expectOrgId: orgId,
    name: "Aster Network",
  });

  expect(await profile(t, career)).not.toBeNull();
  expect(await owner.query(api.viewer.home, {})).toBe("/careers/journey");
});

test("a career profile survives Leave, and home is the career route", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const { as: dan } = await seat(t, orgId, "user_dan", []);
  const career = await addCareer(dan);
  expect(await dan.query(api.viewer.home, {})).toBe("/home");

  await dan.mutation(api.members.leave, { expectOrgId: orgId });

  expect(await profile(t, career)).not.toBeNull();
  expect(await dan.query(api.viewer.home, {})).toBe("/careers/journey");
});
