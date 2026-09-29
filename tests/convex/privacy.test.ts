import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MutationCtx } from "../../convex/_generated/server";
import { aggregate, count, loadCountable } from "../../convex/lib/privacy";
import { personFields } from "./testHelpers";
import { harness, seat, workspace } from "./workspace/helpers";

let next = 0;

async function addOrg(ctx: MutationCtx) {
  const orgId = await ctx.db.insert("orgs", {
    name: "Calder Lane",
    slug: `calder-test-${next++}`,
    privacyThreshold: 5,
    isDemo: false,
    createdAt: 0,
  });
  return { orgId, org: (await ctx.db.get(orgId))! };
}

async function addPeople(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  n: number,
  kind: "owner" | "custom" = "custom",
) {
  const roleId = await ctx.db.insert(
    "orgRoles",
    kind === "owner"
      ? { orgId, kind, name: "Owner", createdAt: 0 }
      : { orgId, kind, name: "Employee", permissions: [], createdAt: 0 },
  );
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

async function setTotals(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  personId: Id<"people">,
  includeInTeamTotals: boolean,
) {
  await ctx.db.insert("settings", {
    orgId,
    personId,
    weeklyReminder: true,
    showAndTellReminder: true,
    askBeforeSharing: true,
    reflectionsOnCredential: false,
    includeInTeamTotals,
    captionsByDefault: false,
    reduceMotion: false,
  });
}

const optOut = (ctx: MutationCtx, orgId: Id<"orgs">, personId: Id<"people">) =>
  setTotals(ctx, orgId, personId, false);

test("aggregate and count only countable people", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const { orgId, org } = await addOrg(ctx);
    const people = await addPeople(ctx, orgId, 6);
    await optOut(ctx, orgId, people[0]);
    // The opted-out person answers 1 and everybody else 4, so the mean is 4
    // only if their answer is left out (3.5 if it is not).
    const answers = people.map((personId, i) => ({
      personId,
      score: i === 0 ? 1 : 4,
    }));
    const scoresOf = async () => {
      const counted = new Set(
        (await loadCountable(ctx, orgId, null)).map((p) => p._id),
      );
      return answers
        .filter((row) => counted.has(row.personId))
        .map((row) => row.score);
    };
    const six = aggregate(await scoresOf(), org);
    // Only the opted-out person finished: counted, that would be 1 of 6.
    const finished = count(
      (await loadCountable(ctx, orgId, null)).map((p) => p._id === people[0]),
      org,
    );

    const more = await addPeople(ctx, orgId, 1);
    await optOut(ctx, orgId, people[1]);
    await optOut(ctx, orgId, more[0]);
    const seven = aggregate(await scoresOf(), org);
    return { six, finished, seven };
  });

  // 6 people, 1 out: 5 count, which is enough.
  expect(result.six).toEqual({ hidden: false, n: 5, value: 4 });
  expect(result.finished).toEqual({ hidden: false, n: 5, value: 0 });
  // 7 people, 3 out: 4 count, which is not. No value in the answer at all.
  expect(result.seven).toEqual({ hidden: true, n: 4 });
});

test("neither the manager nor the asker counts toward the threshold", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const { orgId, org } = await addOrg(ctx);
    const [manager] = await addPeople(ctx, orgId, 1, "owner");
    const employees = await addPeople(ctx, orgId, 4);
    const four = count(
      (await loadCountable(ctx, orgId, manager)).map(() => true),
      org,
    );

    const [fifth] = await addPeople(ctx, orgId, 1);
    const five = await loadCountable(ctx, orgId, null);
    // An employee asking never counts toward their own threshold either.
    const asked = await loadCountable(ctx, orgId, fifth);
    return {
      four,
      five: five.map((p) => p._id),
      asked: asked.map((p) => p._id),
      employees: [...employees, fifth],
    };
  });

  // 4 employees plus the manager: the manager is not one of the counted.
  expect(result.four).toEqual({ hidden: true, n: 4 });
  // Owner-kind seats never count, asked by anybody or by nobody.
  expect(result.five).toEqual(result.employees);
  expect(result.asked).toEqual(result.employees.slice(0, 4));
});

test("an opt-out is read per person, however many settings rows the workspace has", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const { orgId, org } = await addOrg(ctx);
    // 200 older rows left behind by people who have since gone.
    for (const gone of await addPeople(ctx, orgId, 200)) {
      await setTotals(ctx, orgId, gone, true);
      await ctx.db.delete(gone);
    }
    const people = await addPeople(ctx, orgId, 5);
    await optOut(ctx, orgId, people[4]);
    return aggregate(
      (await loadCountable(ctx, orgId, null)).map(() => 4),
      org,
    );
  });
  expect(result).toEqual({ hidden: true, n: 4 });
});

test("leaving a workspace takes the person's settings with them", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const member = await seat(t, orgId, "user_member", []);
  await t.run((ctx) => optOut(ctx, orgId, member.personId));
  await member.as.mutation(api.members.leave, { orgId });
  const left = await t.run((ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_person", (q) => q.eq("personId", member.personId))
      .first(),
  );
  expect(left).toBeNull();
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
  // A stored NaN is no threshold at all, so the floor applies.
  expect(aggregate([4], { privacyThreshold: NaN })).toEqual({
    hidden: true,
    n: 1,
  });

  // A stricter workspace is honoured.
  const strict = { privacyThreshold: 7 };
  expect(aggregate([4, 4, 4, 4, 4, 4], strict)).toEqual({ hidden: true, n: 6 });
  expect(count([true, true, true, true, true, true, false], strict)).toEqual({
    hidden: false,
    n: 7,
    value: 6,
  });
});
