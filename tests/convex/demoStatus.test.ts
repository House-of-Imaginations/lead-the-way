import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { DEMO_TARGETS } from "../../convex/lib/demo/schedule";
import { EVENT_TYPES } from "../../convex/tables/sprint";
import { OWNER, calderLane, harness, workspace } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => vi.unstubAllEnvs());

test("status is null when demo mode is off", async () => {
  const { as } = await calderLane();
  vi.stubEnv("DEMO_MODE", "");
  expect(await as("priya").query(api.demo.status, {})).toBeNull();
});

test("an account outside the demo gets no demo", async () => {
  const t = harness();
  await workspace(t);
  expect(await t.withIdentity(OWNER).query(api.demo.status, {})).toEqual({
    demo: null,
  });
});

test("Dan before he joins gets no demo", async () => {
  const { as } = await calderLane();
  expect(await as("dan").query(api.demo.status, {})).toEqual({ demo: null });
});

test("Priya at setup sees the time, the two accounts and every count", async () => {
  const { as } = await calderLane();
  const status = await as("priya").query(api.demo.status, {});
  const demo = status!.demo!;
  expect(demo.demoNow).toBe(DEMO_TARGETS.setup);
  expect(demo.persona).toBe("priya");
  expect(demo.accounts.map((a) => a.key)).toEqual(["priya", "dan"]);
  expect(demo.counts.map((c) => c.type)).toEqual([...EVENT_TYPES]);
  expect(demo.counts.find((c) => c.type === "sprint.launched")!.count).toBe(0);
  // G-f: types and numbers only, no names and no ids.
  for (const row of demo.counts)
    expect(Object.keys(row).sort()).toEqual(["count", "type"]);
});

test("the counts follow the clock, and Dan sees them once he joins", async () => {
  const { as, orgId } = await calderLane();
  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const demo = (await as("dan").query(api.demo.status, {}))!.demo!;
  expect(demo.persona).toBe("dan");
  expect(demo.demoNow).toBe(DEMO_TARGETS.week1);
  const count = (type: string) =>
    demo.counts.find((c) => c.type === type)!.count;
  expect(count("sprint.launched")).toBe(1);
  expect(count("invite.accepted")).toBeGreaterThan(0);
});
