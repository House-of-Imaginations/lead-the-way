import { type GenericValidator, v } from "convex/values";
import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  CAREER_TABLES,
  ON_REMOVE,
  ORG_TABLES,
  deleteOrg,
} from "../../convex/lib/orgs/cascade";
import schema from "../../convex/schema";
import { harness, workspace } from "./workspace/helpers";

/** The org layer's own tables. Everything else must be in `ORG_TABLES`. */
const ORG_LAYER = ["orgs", "profiles", "people", "orgRoles", "orgInvites"];

test("every table is cleared with its workspace or belongs to the org layer", () => {
  expect(Object.keys(schema.tables).sort()).toEqual(
    [...ORG_LAYER, ...ORG_TABLES, ...CAREER_TABLES].sort(),
  );
});

/** Does this validator hold an id into `table`, at any depth? */
function holds(validator: GenericValidator, table: string): boolean {
  switch (validator.kind) {
    case "id":
      return validator.tableName === table;
    case "object":
      return Object.values(validator.fields).some((f) => holds(f, table));
    case "array":
      return holds(validator.element, table);
    case "union":
      return validator.members.some((m) => holds(m, table));
    case "record":
      return holds(validator.value, table);
    default:
      return false;
  }
}

/** Every field name in this validator, nested objects included, as a dotted path. */
function fieldsOf(validator: GenericValidator, at = ""): string[] {
  switch (validator.kind) {
    case "object":
      return Object.entries(validator.fields).flatMap(([name, f]) => [
        at + name,
        ...fieldsOf(f, `${at}${name}.`),
      ]);
    case "array":
      return fieldsOf(validator.element, at);
    case "union":
      return validator.members.flatMap((m) => fieldsOf(m, at));
    case "record":
      return fieldsOf(validator.value, at);
    default:
      return [];
  }
}

test("fieldsOf looks inside nested objects", () => {
  expect(
    fieldsOf(
      v.object({
        a: v.optional(v.object({ employerName: v.string() })),
        b: v.array(v.union(v.null(), v.object({ c: v.string() }))),
      }),
    ),
  ).toEqual(["a", "a.employerName", "b", "b.c"]);
});

test("X1 and P1: career tables hold no workspace or employer data, and team tables no career ids", () => {
  const team = [...ORG_LAYER, ...ORG_TABLES] as (keyof typeof schema.tables)[];
  for (const name of CAREER_TABLES) {
    const validator = schema.tables[name].validator;
    expect(
      fieldsOf(validator).filter((f) =>
        /org|employer|company|workspace|workplace|domain|work_?email|seat|people|person/i.test(
          f,
        ),
      ),
      name,
    ).toEqual([]);
    for (const other of team)
      expect(holds(validator, other), `${name} -> ${other}`).toBe(false);
  }
  for (const name of team)
    for (const career of CAREER_TABLES)
      expect(
        holds(schema.tables[name].validator, career),
        `${name} -> ${career}`,
      ).toBe(false);
});

test("every table holding a person id says what removing that person does to it (M-c)", () => {
  // Every table, the org layer's too: orgInvites.personId is one.
  const holding = Object.entries(schema.tables)
    .filter(([, table]) => holds(table.validator, "people"))
    .map(([name]) => name)
    .sort();
  expect(Object.keys(ON_REMOVE).sort()).toEqual(holding);
});

type RunCtx = Parameters<Parameters<ReturnType<typeof harness>["run"]>[0]>[0];

async function fill(ctx: RunCtx, orgId: Id<"orgs">) {
  // createWorkspace already made the one team (spec 4.2).
  const team = await ctx.db
    .query("teams")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique();
  const teamId = team!._id;
  await ctx.db.patch(teamId, { name: "Client Services team" });
  const sprintId = await ctx.db.insert("sprints", {
    orgId,
    teamId,
    status: "draft",
    startDate: "2026-09-09",
    timeZone: "Australia/Melbourne",
    weeks: 4,
    protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
    courseTitle: "AI Productivity Fundamentals",
    createdAt: 0,
  });
  await ctx.db.insert("events", {
    orgId,
    sprintId,
    type: "hour.committed",
    at: 0,
  });
  await ctx.db.insert("demoScript", { orgId, key: "priya.team", at: 0 });
  const person = await ctx.db
    .query("people")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  const screenshotId = await ctx.storage.store(new Blob(["x"]));
  await ctx.db.insert("projects", {
    orgId,
    personId: person!._id,
    sprintId,
    startedWeek: 1,
    title: "Draft the weekly update",
    before: "",
    change: "",
    after: "",
    resultTypes: [],
    humanReviewed: false,
    dataSafe: false,
    screenshotId,
    status: "draft",
    sharing: "private",
    autosavedAt: 0,
  });
  await ctx.db.insert("sprintOutcomes", {
    orgId,
    sprintId,
    takenAt: 0,
    counted: [],
    threshold: 5,
    completed: { hidden: true, n: 0 },
    presented: { hidden: true, n: 0 },
    categories: [],
    answers: [],
  });
  const imageId = await ctx.storage.store(new Blob(["x"]));
  await ctx.db.patch(orgId, { imageId });
  return [screenshotId, imageId];
}

test("deleting a workspace clears its product rows and nobody else's", async () => {
  const t = harness();
  const { owner, orgId: gone } = await workspace(t, "Gone Network");
  const { orgId: kept } = await owner.mutation(api.orgs.create, {
    name: "Kept Network",
  });

  const files = await t.run(async (ctx) => {
    const goneFiles = await fill(ctx, gone);
    const keptFiles = await fill(ctx, kept);
    await deleteOrg(ctx, gone);
    return {
      gone: await Promise.all(goneFiles.map((id) => ctx.db.system.get(id))),
      kept: await Promise.all(keptFiles.map((id) => ctx.db.system.get(id))),
    };
  });
  expect(files.gone).toEqual([null, null]);
  expect(files.kept.every((f) => f !== null)).toBe(true);

  const left = await t.run(async (ctx) => ({
    teams: (await ctx.db.query("teams").collect()).map((r) => r.orgId),
    sprints: (await ctx.db.query("sprints").collect()).map((r) => r.orgId),
    events: (await ctx.db.query("events").collect()).map((r) => r.orgId),
    demoScript: (await ctx.db.query("demoScript").collect()).map(
      (r) => r.orgId,
    ),
    sprintOutcomes: (await ctx.db.query("sprintOutcomes").collect()).map(
      (r) => r.orgId,
    ),
  }));
  expect(left).toEqual({
    teams: [kept],
    sprints: [kept],
    events: [kept],
    demoScript: [kept],
    sprintOutcomes: [kept],
  });
});

test("a new workspace starts at the minimum threshold and is not a demo", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);

  const org = await t.run((ctx) => ctx.db.get(orgId));
  expect(org).toMatchObject({ privacyThreshold: 5, isDemo: false });

  // The wire shape is unchanged: the new fields must not leak through the
  // return validator (a spread in `publicOrg` would fail this call).
  expect(await owner.query(api.orgs.active, {})).toMatchObject({
    org: { _id: orgId, name: "Aster Network" },
  });
});
