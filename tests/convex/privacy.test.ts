import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MutationCtx } from "../../convex/_generated/server";
import type { Permission } from "../../convex/lib/orgs/permissions";
import {
  aggregate,
  count,
  countSeated,
  loadCountable,
  loadSeated,
} from "../../convex/lib/privacy";
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

/** `n` people on one new role: the owner role, or a custom one holding `permissions`. */
async function addPeople(
  ctx: MutationCtx,
  orgId: Id<"orgs">,
  n: number,
  permissions: "owner" | Permission[] = [],
) {
  const roleId = await ctx.db.insert(
    "orgRoles",
    permissions === "owner"
      ? { orgId, kind: "owner", name: "Owner", createdAt: 0 }
      : { orgId, kind: "custom", name: "Employee", permissions, createdAt: 0 },
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

/** A new workspace of `n` employees, as `loadCountable` returns them. */
async function countableOf(ctx: MutationCtx, n: number) {
  const { orgId, org } = await addOrg(ctx);
  await addPeople(ctx, orgId, n);
  return await loadCountable(ctx, org, null);
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
    const scoreOf = (p: { _id: Id<"people"> }) => (p._id === people[0] ? 1 : 4);
    const six = aggregate(await loadCountable(ctx, org, null), scoreOf, org);
    // Only the opted-out person finished: counted, that would be 1 of 6.
    const finished = count(
      await loadCountable(ctx, org, null),
      (p) => p._id === people[0],
      org,
    );

    const more = await addPeople(ctx, orgId, 1);
    await optOut(ctx, orgId, people[1]);
    await optOut(ctx, orgId, more[0]);
    const seven = aggregate(await loadCountable(ctx, org, null), scoreOf, org);
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
    const four = count(await loadCountable(ctx, org, manager), () => true, org);

    const [fifth] = await addPeople(ctx, orgId, 1);
    const five = await loadCountable(ctx, org, null);
    // An employee asking never counts toward their own threshold either.
    const asked = await loadCountable(ctx, org, fifth);
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

test("nobody who can read team totals counts toward them", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const { orgId, org } = await addOrg(ctx);
    const employees = await addPeople(ctx, orgId, 4);
    // A custom role, not the owner one, that can read the overview.
    const [lead] = await addPeople(ctx, orgId, 1, ["team:insights"]);
    const counted = await loadCountable(ctx, org, null);
    return {
      counted: counted.map((p) => p._id),
      lead,
      employees,
      total: count(counted, () => true, org),
    };
  });
  expect(result.counted).toEqual(result.employees);
  expect(result.total).toEqual({ hidden: true, n: 4 });
});

test("one person with several answers is one response", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const { orgId, org } = await addOrg(ctx);
    const people = await addPeople(ctx, orgId, 5);
    // Four people answer, one of them twice: five rows, four respondents.
    const rows = [people[0], people[0], people[1], people[2], people[3]].map(
      (personId) => ({ personId, score: 4 }),
    );
    return aggregate(
      await loadCountable(ctx, org, null),
      (p) => rows.find((r) => r.personId === p._id)?.score,
      org,
    );
  });
  expect(result).toEqual({ hidden: true, n: 4 });
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
    return aggregate(await loadCountable(ctx, org, null), () => 4, org);
  });
  expect(result).toEqual({ hidden: true, n: 4 });
});

test("leaving a workspace takes the person's settings with them", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const member = await seat(t, orgId, "user_member", []);
  await t.run((ctx) => optOut(ctx, orgId, member.personId));
  await member.as.mutation(api.members.leave, { expectOrgId: orgId });
  const left = await t.run((ctx) =>
    ctx.db
      .query("settings")
      .withIndex("by_person", (q) => q.eq("personId", member.personId))
      .first(),
  );
  expect(left).toBeNull();
});

test("the threshold can't go below 5", async () => {
  const t = harness();
  const lax = { privacyThreshold: 3 };
  const strict = { privacyThreshold: 7 };
  const scores = [4, 4, 4, 3, 3];
  const result = await t.run(async (ctx) => {
    const five = await countableOf(ctx, 5);
    const four = await countableOf(ctx, 4);
    const one = await countableOf(ctx, 1);
    const six = await countableOf(ctx, 6);
    const seven = await countableOf(ctx, 7);
    return {
      five: aggregate(five, (p) => scores[five.indexOf(p)], lax),
      four: aggregate(four, (p) => scores[four.indexOf(p)], lax),
      fourDid: count(four, (p) => four.indexOf(p) !== 2, lax),
      // A stored NaN is no threshold at all, so the floor applies.
      nan: aggregate(one, () => 4, { privacyThreshold: NaN }),
      // A stricter workspace is honoured.
      six: aggregate(six, () => 4, strict),
      seven: count(seven, (p) => seven.indexOf(p) !== 6, strict),
    };
  });
  expect(result.five).toEqual({ hidden: false, n: 5, value: 3.6 });
  expect(result.four).toEqual({ hidden: true, n: 4 });
  expect(result.fourDid).toEqual({ hidden: true, n: 4 });
  expect(result.nan).toEqual({ hidden: true, n: 1 });
  expect(result.six).toEqual({ hidden: true, n: 6 });
  expect(result.seven).toEqual({ hidden: false, n: 7, value: 6 });
});

test("a sprint manager is not seated and never counts (Ruling 1)", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const { orgId, org } = await addOrg(ctx);
    const employees = await addPeople(ctx, orgId, 5);
    // Runs the sprint without reading team totals: still a manager.
    await addPeople(ctx, orgId, 1, ["sprint:manage"]);
    return {
      employees,
      seated: (await loadSeated(ctx, org)).map((p) => p._id),
      counted: (await loadCountable(ctx, org, null)).map((p) => p._id),
    };
  });
  expect(result.seated).toEqual(result.employees);
  expect(result.counted).toEqual(result.employees);
});

test("countSeated counts the whole seated team, opted out or not, hidden below the threshold", async () => {
  const t = harness();
  const result = await t.run(async (ctx) => {
    const { orgId, org } = await addOrg(ctx);
    const people = await addPeople(ctx, orgId, 5);
    // Presenting is a public act (R-i): an opt-out from totals doesn't hide it.
    await optOut(ctx, orgId, people[0]);
    const seated = await loadSeated(ctx, org);
    const did = (p: { _id: Id<"people"> }) =>
      p._id === people[0] || p._id === people[1];
    return {
      five: countSeated(seated, did, org),
      four: countSeated(seated.slice(0, 4), did, org),
      strict: countSeated(seated, did, { privacyThreshold: 7 }),
    };
  });
  expect(result.five).toEqual({ hidden: false, n: 5, value: 2 });
  expect(result.four).toEqual({ hidden: true, n: 4 });
  expect(result.strict).toEqual({ hidden: true, n: 5 });
});
