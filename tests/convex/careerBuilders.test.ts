import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { careerMutation, careerQuery } from "../../convex/lib/customFunctions";
import schema from "../../convex/schema";
import { registerComponents, seedDemoAccounts } from "./testHelpers";
import {
  addCareer,
  calderLane,
  clock,
  modules,
  type T,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Both builders, mounted beside the real modules, returning the career's first name. */
function probed(): T {
  const read = careerQuery({
    args: {},
    returns: v.string(),
    handler: async (ctx) => ctx.career.profile.firstName,
  });
  const write = careerMutation({
    args: {},
    returns: v.string(),
    handler: async (ctx) => ctx.career.profile.firstName,
  });
  const t = convexTest(schema, {
    ...modules,
    "../../../convex/probe.ts": async () => ({ read, write }),
  });
  registerComponents(t);
  return t;
}
const READ = makeFunctionReference<"query">("probe:read");
const WRITE = makeFunctionReference<"mutation">("probe:write");

test("careerQuery hands the handler the caller's career", async () => {
  const t = probed();
  const loner = t.withIdentity({ subject: "user_loner" });
  await addCareer(loner);
  expect(await loner.query(READ, {})).toBe("Dan");
  expect(await loner.query(READ, { hour: 1 })).toBe("Dan");
  expect(await loner.mutation(WRITE, {})).toBe("Dan");
});

test("careerQuery refuses an account without a career track", async () => {
  const t = probed();
  await expect(
    t.withIdentity({ subject: "user_loner" }).query(READ, {}),
  ).rejects.toMatchObject({ data: { code: "NO_CAREER_TRACK" } });
  await expect(t.query(READ, {})).rejects.toMatchObject({
    data: { code: "NOT_SIGNED_IN" },
  });
});

test("careerMutation refuses a team-only account", async () => {
  const t = probed();
  const accounts = await seedDemoAccounts(t);
  await t.mutation(internal.seed.writeCalderLane, { accounts });
  await expect(
    t.withIdentity({ subject: accounts.priya }).mutation(WRITE, {}),
  ).rejects.toMatchObject({ data: { code: "NO_CAREER_TRACK" } });
});

test("the manager overview is identical with or without Dan's career track", async () => {
  // Review Focus 5 (X2).
  const { t, as } = await calderLane();
  await clock(t, "week2");
  const before = await as("priya").query(api.manager.overview, {});
  expect(before?.phase).toBe("active");
  await addCareer(as("dan"));
  expect(await as("priya").query(api.manager.overview, {})).toEqual(before);
});
