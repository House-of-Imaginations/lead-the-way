import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getViewer, requireViewer } from "../../convex/lib/viewer";
import { personFields } from "./testHelpers";
import { OWNER, harness, seat, workspace } from "./workspace/helpers";

test("getViewer refuses a signed-out caller", async () => {
  const t = harness();
  await expect(t.run((ctx) => getViewer(ctx))).rejects.toMatchObject({
    data: { code: "NOT_SIGNED_IN" },
  });
});

test("getViewer falls back when the active workspace is gone", async () => {
  const t = harness();
  const { owner, orgId: first } = await workspace(t, "First Network");
  const { orgId: second } = await owner.mutation(api.orgs.create, {
    name: "Second Network",
  });
  const viewerOrg = () =>
    owner.run(async (ctx) => (await getViewer(ctx))?.org._id ?? null);

  // Creating a workspace opens it.
  expect(await viewerOrg()).toBe(second);

  // The active workspace is deleted: the next seat answers.
  await owner.mutation(api.orgs.remove, { orgId: second });
  expect(await viewerOrg()).toBe(first);

  // A stale pointer, however it got there, is not an error either.
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", OWNER.subject))
      .unique();
    await ctx.db.patch(profile!._id, { activeOrgId: second });
  });
  expect(await viewerOrg()).toBe(first);

  // No seat left anywhere: signed in, no workspace. Null, never a throw.
  await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", first))
      .collect();
    for (const person of people) await ctx.db.delete(person._id);
  });
  expect(await owner.run((ctx) => getViewer(ctx))).toBeNull();
  expect(await owner.query(api.orgs.active, {})).toBeNull();
  // The builders turn that into a code the app routes on.
  await expect(
    owner.run((ctx) => requireViewer(ctx, [])),
  ).rejects.toMatchObject({ data: { code: "NO_WORKSPACE" } });
});

test("requireViewer checks permissions, never role names", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const roleId = roles.find((r) => r.name === "Employee")!._id;
    await ctx.db.insert("people", {
      orgId,
      roleId,
      ...personFields("user_employee"),
    });
  });
  const employee = t.withIdentity({ subject: "user_employee" });
  await expect(
    employee.run((ctx) => requireViewer(ctx, ["team:insights"])),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

  // A custom role holding the permission passes, whatever it is called.
  const lead = await seat(t, orgId, "user_lead", ["team:insights"]);
  const viewer = await lead.as.run((ctx) =>
    requireViewer(ctx, ["team:insights"]),
  );
  expect(viewer.person._id).toBe(lead.personId);
});

test("a seat whose role is gone is skipped for the next one, or none", async () => {
  const t = harness();
  const { owner, orgId: first } = await workspace(t, "First Network");
  const { orgId: second } = await owner.mutation(api.orgs.create, {
    name: "Second Network",
  });
  const viewerOrg = () =>
    owner.run(async (ctx) => (await getViewer(ctx))?.org._id ?? null);
  const dropRole = (orgId: Id<"orgs">) =>
    t.run(async (ctx) => {
      const mine = await ctx.db
        .query("people")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", OWNER.subject).eq("orgId", orgId),
        )
        .unique();
      await ctx.db.delete(mine!.roleId);
    });

  expect(await viewerOrg()).toBe(second);
  await dropRole(second);
  expect(await viewerOrg()).toBe(first);
  await dropRole(first);
  expect(await viewerOrg()).toBeNull();
});
