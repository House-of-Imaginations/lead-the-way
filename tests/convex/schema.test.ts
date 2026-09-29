import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MutationCtx } from "../../convex/_generated/server";
import { ORG_TABLES, deleteOrg } from "../../convex/lib/orgs/cascade";
import schema from "../../convex/schema";
import { harness, workspace } from "./workspace/helpers";

/** The org layer's own tables. Everything else must be in `ORG_TABLES`. */
const ORG_LAYER = ["orgs", "profiles", "people", "orgRoles", "orgInvites"];

test("every table is cleared with its workspace or belongs to the org layer", () => {
  expect(Object.keys(schema.tables).sort()).toEqual(
    [...ORG_LAYER, ...ORG_TABLES].sort(),
  );
});

async function fill(ctx: MutationCtx, orgId: Id<"orgs">) {
  const teamId = await ctx.db.insert("teams", {
    orgId,
    name: "Client Services team",
    challenges: [],
    createdAt: 0,
  });
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
}

test("deleting a workspace clears its product rows and nobody else's", async () => {
  const t = harness();
  const { owner, orgId: gone } = await workspace(t, "Gone Network");
  const { orgId: kept } = await owner.mutation(api.orgs.create, {
    name: "Kept Network",
  });

  await t.run(async (ctx) => {
    await fill(ctx, gone);
    await fill(ctx, kept);
    await deleteOrg(ctx, gone);
  });

  const left = await t.run(async (ctx) => ({
    teams: (await ctx.db.query("teams").collect()).map((r) => r.orgId),
    sprints: (await ctx.db.query("sprints").collect()).map((r) => r.orgId),
    events: (await ctx.db.query("events").collect()).map((r) => r.orgId),
    demoScript: (await ctx.db.query("demoScript").collect()).map(
      (r) => r.orgId,
    ),
  }));
  expect(left).toEqual({
    teams: [kept],
    sprints: [kept],
    events: [kept],
    demoScript: [kept],
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
