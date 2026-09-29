import { expect, test } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import type { MutationCtx } from "../../convex/_generated/server";
import { aggregate, count, loadCountable } from "../../convex/lib/privacy";
import { personFields } from "./testHelpers";
import { harness } from "./workspace/helpers";

let next = 0;

async function addPeople(ctx: MutationCtx, orgId: Id<"orgs">, n: number) {
  const roleId = await ctx.db.insert("orgRoles", {
    orgId,
    kind: "custom",
    name: "Employee",
    permissions: [],
    createdAt: 0,
  });
  const ids: Id<"people">[] = [];
  for (let i = 0; i < n; i++) {
    ids.push(
      await ctx.db.insert("people", {
        orgId,
        roleId,
        ...personFields(`user_${next++}`),
      }),
    );
  }
  return ids;
}

async function optOut(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  personId: Id<"people">,
) {
  await ctx.db.insert("settings", {
    orgId,
    personId,
    weeklyReminder: true,
    showAndTellReminder: true,
    askBeforeSharing: true,
    reflectionsOnCredential: false,
    includeInTeamTotals: false,
    captionsByDefault: false,
    reduceMotion: false,
  });
}

test("aggregate counts only countable people", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("orgs", {
      name: "Calder Lane",
      slug: "calder-test",
      privacyThreshold: 5,
      isDemo: false,
      createdAt: 0,
    });
    const org = (await ctx.db.get(orgId))!;
    const people = await addPeople(ctx, orgId, 6);
    await optOut(ctx, orgId, people[0]);
    // Everybody answers 4; the opted-out answer must not be in the mean or n.
    const six = aggregate(
      (await loadCountable(ctx, orgId)).map(() => 4),
      org,
    );

    const more = await addPeople(ctx, orgId, 1);
    await optOut(ctx, orgId, people[1]);
    await optOut(ctx, orgId, more[0]);
    const seven = aggregate(
      (await loadCountable(ctx, orgId)).map(() => 4),
      org,
    );
    return { six, seven };
  });

  // 6 people, 1 out: 5 count, which is enough.
  expect(result.six).toEqual({ hidden: false, n: 5, value: 4 });
  // 7 people, 3 out: 4 count, which is not. No value in the answer at all.
  expect(result.seven).toEqual({ hidden: true, n: 4 });
});

test("the threshold can't go below 5", () => {
  const lax = { privacyThreshold: 3 };
  expect(aggregate([4, 4, 4, 3, 3], lax)).toEqual({
    hidden: false,
    n: 5,
    value: 3.6,
  });
  expect(aggregate([4, 4, 4, 3], lax)).toEqual({ hidden: true, n: 4 });
  expect(count([true, true, false, true], lax)).toEqual({ hidden: true, n: 4 });

  // A stricter workspace is honoured.
  const strict = { privacyThreshold: 7 };
  expect(aggregate([4, 4, 4, 4, 4, 4], strict)).toEqual({ hidden: true, n: 6 });
  expect(count([true, true, true, true, true, true, false], strict)).toEqual({
    hidden: false,
    n: 7,
    value: 6,
  });
});
