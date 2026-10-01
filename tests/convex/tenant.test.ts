import { expect, test } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { getInOrg } from "../../convex/lib/tenant";
import { call, callsFor, fixtures, publicFunctions } from "./sweep";
import { harness, workspace, type T } from "./workspace/helpers";

/** The fixture workspace's rows, to prove a refused call wrote nothing. */
async function rowsOf(t: T, orgId: Id<"orgs">) {
  return await t.run(async (ctx) => ({
    org: await ctx.db.get(orgId),
    roles: await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
    people: await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
    invites: await ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
      .collect(),
    events: await ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
    teams: await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
    sprints: await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
    surveyResponses: await ctx.db
      .query("surveyResponses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
    pathwayProgress: await ctx.db
      .query("pathwayProgress")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
    agreements: await ctx.db
      .query("agreements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  }));
}

test("getInOrg refuses another workspace's document", async () => {
  const t = harness();
  const ids = await fixtures(t);
  const { orgId: birch } = await workspace(t, "Birch Studio");
  const mine = await t.run((ctx) => getInOrg(ctx, ids.orgId, ids.inviteId));
  expect(mine.token).toBe("tok");
  await expect(
    t.run((ctx) => getInOrg(ctx, birch, ids.inviteId)),
  ).rejects.toMatchObject({
    data: { code: "NOT_FOUND", message: "That no longer exists." },
  });
  // Gone reads the same as elsewhere, so an id can't be probed.
  await t.run((ctx) => ctx.db.delete(ids.personId));
  await expect(
    t.run((ctx) => getInOrg(ctx, ids.orgId, ids.personId)),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
});

/** True when `value` holds one of `ids` at any depth, `expectOrgId` aside. */
function holdsId(value: unknown, ids: Set<unknown>): boolean {
  if (ids.has(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, v]) => key !== "expectOrgId" && holdsId(v, ids),
  );
}

test("no public function reads another workspace's ids", async () => {
  const t = harness();
  const ids = await fixtures(t);
  // The owner of another workspace, signed in, with that workspace open.
  const { owner: attacker, orgId: attackerOrg } = await workspace(
    t,
    "Birch Studio",
  );
  const theirs = new Set<unknown>(Object.values(ids) as unknown[]);
  const calls = callsFor(ids);
  const before = await rowsOf(t, ids.orgId);

  const leaked: string[] = [];
  let swept = 0;
  let reached = 0;
  for (const fn of publicFunctions()) {
    const fixed = calls[fn.name];
    if (!fixed) continue;
    let args = fixed;
    if (holdsId(fixed, theirs)) {
      // A foreign id inside the args: echo the attacker's own workspace, so
      // the call gets past the workspace check and the handler's own
      // `getInOrg` is what must refuse it.
      if ("expectOrgId" in fixed) args = { ...fixed, expectOrgId: attackerOrg };
      reached++;
    } else if (fixed.expectOrgId !== ids.orgId) {
      continue;
    }
    // Otherwise the only foreign id is `expectOrgId`: the workspace check
    // itself must refuse the victim's.
    swept++;
    try {
      const answer = await call(attacker, fn, args);
      // A mutation that resolves at all got past the tenant check, even
      // when it returns null on success.
      if (fn.kind !== "query" || answer !== null) {
        leaked.push(`${fn.name} answered`);
      }
    } catch {
      // Refused, as it should be.
    }
  }
  expect(leaked).toEqual([]);
  expect(await rowsOf(t, ids.orgId)).toEqual(before);
  // The sweep reached every function that takes an id (21 before P4, 29
  // after Task 5), and 20 of them hold one past the workspace check. Raise
  // these as functions join.
  expect(swept).toBeGreaterThanOrEqual(29);
  expect(reached).toBeGreaterThanOrEqual(20);
});
