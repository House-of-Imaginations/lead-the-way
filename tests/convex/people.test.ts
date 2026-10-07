import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { firstNameOf, initialsOf } from "../../convex/lib/orgs/people";
import {
  DEFAULT_SETTINGS,
  settingsOf,
  writeSettings,
} from "../../convex/lib/settings";
import { seedAuthUser } from "./testHelpers";
import { harness, workspace } from "./workspace/helpers";

test("initials come from the first and last word", () => {
  expect(initialsOf("Priya Raman")).toBe("PR");
  expect(initialsOf("  tomás  de la reyes ")).toBe("TR");
  expect(initialsOf("Dan")).toBe("D");
  expect(initialsOf("   ")).toBe("?");
});

test("a first name survives stray whitespace", () => {
  expect(firstNameOf("Dan Okafor")).toBe("Dan");
  expect(firstNameOf("\tDan  Okafor ")).toBe("Dan");
  expect(firstNameOf("   ")).toBe("");
});

test("joining makes a people row with a name, initials and email", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, {});
  const roleId = roles.find((role) => !role.isOwner)!._id;
  const bob = await seedAuthUser(t, {
    name: "Bob Stone",
    email: "Bob@Example.com",
    emailVerified: true,
  });

  const { token } = await owner.mutation(api.invites.create, {
    roleId,
    expectOrgId: orgId,
  });
  await t.withIdentity(bob).mutation(api.invites.accept, { token });

  const members = await owner.query(api.members.list, {});
  expect(members.find((m) => m.userId === bob.subject)).toMatchObject({
    name: "Bob Stone",
    email: "bob@example.com",
    roleId,
    isOwner: false,
  });
  const row = await t.run((ctx) =>
    ctx.db
      .query("people")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", bob.subject).eq("orgId", orgId),
      )
      .unique(),
  );
  expect(row).toMatchObject({
    initials: "BS",
    jobTitle: "",
    timeZone: "Australia/Melbourne",
  });
});

test("a profile is only a name and the workspace the app opens", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await owner.mutation(api.profiles.saveProfile, { displayName: "Pat" });

  const profile = await owner.query(api.profiles.me, {});
  expect(Object.keys(profile ?? {}).sort()).toEqual([
    "_creationTime",
    "_id",
    "activeOrgId",
    "createdAt",
    "displayName",
    "userId",
  ]);
  expect(profile).toMatchObject({ displayName: "Pat", activeOrgId: orgId });
});

test("a new seat starts from your open seat's time zone and display settings", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  await t.run(async (ctx) => {
    const seat = (await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first())!;
    // A first seat starts from the defaults.
    expect(seat.timeZone).toBe("Australia/Melbourne");
    expect(await settingsOf(ctx, seat._id)).toEqual(DEFAULT_SETTINGS);
    await ctx.db.patch(seat._id, { timeZone: "Europe/London" });
    await writeSettings(ctx, seat, {
      reduceMotion: true,
      captionsByDefault: false,
      includeInTeamTotals: false,
      weeklyReminder: false,
      askBeforeSharing: false,
      reflectionsOnCredential: false,
      showAndTellReminder: false,
    });
  });
  const { orgId: birch } = await owner.mutation(api.orgs.create, {
    name: "Birch",
  });
  const next = await t.run(async (ctx) => {
    const seat = (await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", birch))
      .first())!;
    return {
      timeZone: seat.timeZone,
      settings: await settingsOf(ctx, seat._id),
    };
  });
  // Display settings follow; privacy and reminders start fresh.
  expect(next).toEqual({
    timeZone: "Europe/London",
    settings: {
      ...DEFAULT_SETTINGS,
      reduceMotion: true,
      captionsByDefault: false,
    },
  });
});

test("accepting an invitation copies the open seat's time zone and display settings too", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const bob = await seedAuthUser(t, {
    name: "Bob Stone",
    email: "bob@example.com",
    emailVerified: true,
  });
  // Bob's own workspace is the one he has open.
  const { orgId: birch } = await t
    .withIdentity(bob)
    .mutation(api.orgs.create, { name: "Birch" });
  await t.run(async (ctx) => {
    const seat = (await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", birch))
      .first())!;
    await ctx.db.patch(seat._id, { timeZone: "Europe/London" });
    await writeSettings(ctx, seat, {
      reduceMotion: true,
      captionsByDefault: false,
      includeInTeamTotals: false,
    });
  });
  const roles = await owner.query(api.orgRoles.list, {});
  const { token } = await owner.mutation(api.invites.create, {
    roleId: roles.find((role) => !role.isOwner)!._id,
    expectOrgId: orgId,
  });
  await t.withIdentity(bob).mutation(api.invites.accept, { token });

  const next = await t.run(async (ctx) => {
    const seat = (await ctx.db
      .query("people")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", bob.subject).eq("orgId", orgId),
      )
      .unique())!;
    return {
      timeZone: seat.timeZone,
      settings: await settingsOf(ctx, seat._id),
    };
  });
  expect(next).toEqual({
    timeZone: "Europe/London",
    settings: {
      ...DEFAULT_SETTINGS,
      reduceMotion: true,
      captionsByDefault: false,
    },
  });
});

// Guard test: passes before the change too (the defaults write no row).
test("a new seat from a default open seat writes no settings row", async () => {
  const t = harness();
  const { owner } = await workspace(t);
  const { orgId: birch } = await owner.mutation(api.orgs.create, {
    name: "Birch",
  });
  const rows = await t.run((ctx) =>
    ctx.db
      .query("settings")
      .filter((q) => q.eq(q.field("orgId"), birch))
      .collect(),
  );
  expect(rows).toEqual([]);
});
