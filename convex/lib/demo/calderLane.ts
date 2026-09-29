import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { assertFlag } from "../../app";
import { ensureProfile } from "../account/ensureProfile";
import { throwUserError } from "../errors";
import { deleteOrg } from "../orgs/cascade";
import { insertPerson } from "../orgs/people";
import { ACCOUNT_HOLDERS, castOf, demoUserId, type CastKey } from "./cast";
import { DEMO_NOW, DEMO_TIME_ZONE, SCHEDULE } from "./schedule";

export const DEMO_SLUG = "calder-lane";

/**
 * Throw away the demo workspace and write it fresh, as it stands on Tuesday
 * 1 September at 9:30 AM: Priya, an unsaved team, a draft sprint, and the
 * script rows. One mutation, so a reset is all or nothing.
 *
 * Only ever deletes the workspace with the demo slug, and refuses one that
 * isn't a demo: `RESERVED` stops one being made through the app, and this
 * stops anything else from wiping it. Accounts survive; product rows don't.
 */
export async function writeCalderLane(
  ctx: MutationCtx,
  accounts: Record<string, string>,
): Promise<Id<"orgs">> {
  assertFlag("demo", true);
  const idOf = (key: CastKey) => {
    const id = accounts[key];
    if (!id) throw new Error(`The demo account for ${key} is missing.`);
    return id;
  };

  const old = await ctx.db
    .query("orgs")
    .withIndex("by_slug", (q) => q.eq("slug", DEMO_SLUG))
    .unique();
  if (old && !old.isDemo) {
    throw new Error(
      `${DEMO_SLUG} belongs to a real workspace. Refusing to reset it.`,
    );
  }
  if (old) await deleteOrg(ctx, old._id);

  const now = Date.now();
  const orgId = await ctx.db.insert("orgs", {
    name: "Calder Lane",
    slug: DEMO_SLUG,
    domain: "calderlane.com.au",
    partnerName: "Southbank Business Collective",
    privacyThreshold: 5,
    isDemo: true,
    demoNow: DEMO_NOW,
    createdAt: now,
  });
  const managerRoleId = await ctx.db.insert("orgRoles", {
    orgId,
    kind: "owner",
    name: "Manager",
    createdAt: now,
  });
  await ctx.db.insert("orgRoles", {
    orgId,
    kind: "custom",
    name: "Employee",
    permissions: [],
    createdAt: now,
  });

  // Every persona opens the demo, under the cast name. Those without a seat
  // yet fall back to "no workspace" (`getViewer`) until they join.
  for (const person of ACCOUNT_HOLDERS) {
    const profile = await ensureProfile(ctx, idOf(person.key));
    await ctx.db.patch(profile._id, {
      displayName: person.name,
      activeOrgId: orgId,
    });
  }
  await insertPerson(
    ctx,
    idOf("priya"),
    orgId,
    managerRoleId,
    castOf("priya").jobTitle,
  );

  const teamId = await ctx.db.insert("teams", {
    orgId,
    name: "Client Services team",
    challenges: [],
    createdAt: DEMO_NOW,
  });
  await ctx.db.insert("sprints", {
    orgId,
    teamId,
    status: "draft",
    startDate: "2026-09-09",
    timeZone: DEMO_TIME_ZONE,
    weeks: 4,
    protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
    courseTitle: "AI Productivity Fundamentals",
    createdAt: DEMO_NOW,
  });
  for (const [key, at] of Object.entries(SCHEDULE)) {
    await ctx.db.insert("demoScript", { orgId, key, at });
  }
  return orgId;
}

/** The existing demo accounts, for a reset from inside the app (no sign-up there). */
export async function demoAccounts(
  ctx: MutationCtx,
): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const person of ACCOUNT_HOLDERS) {
    const id = await demoUserId(ctx, person.email);
    if (!id) {
      throwUserError(
        "DEMO_NOT_SEEDED",
        "The demo accounts are missing. Run seed:reset from the terminal first.",
      );
    }
    ids[person.key] = id;
  }
  return ids;
}
