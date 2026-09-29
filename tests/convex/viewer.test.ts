import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { getViewer, requireViewer } from "../../convex/lib/viewer";
import { OWNER, harness, workspace } from "./workspace/helpers";

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
