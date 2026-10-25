import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { assertFlag } from "../app";
import { ACCOUNT_HOLDERS, CAREER_CAST, demoUserId } from "../lib/demo/cast";
import { deleteProfileRows } from "./tracks";

/**
 * Spec 11.2, scoped to demo-owned rows (P1): the career profiles of every
 * cast account (the careers cast, and Calder Lane's, so Dan is left
 * team-only, D4) and of the profile-only `seed-` users, with everything
 * `deleteCareer` takes; their badges and endorsements; the demo guides'
 * crews and every crew-keyed row; the seeded partner; the clock; and the
 * anonymous `careerEvents`. Real learners' rows and `mapDrafts` (they
 * expire) stay. Demo only; the reset reseeds right after (`writePivotCrews`).
 * Returns how many rows went.
 */
export async function wipeCareers(ctx: MutationCtx): Promise<number> {
  assertFlag("demo", true);
  let count = 0;
  const del = async (rows: { _id: Id<TableNames> }[]) => {
    for (const row of rows) await ctx.db.delete(row._id);
    count += rows.length;
  };
  // Counts only, and they grow with signed-out use, so in batches (M1).
  // ponytail: batches inside one transaction, so the ceiling is a mutation's
  // write limit (about 16,000 rows); schedule the rest past that.
  for (;;) {
    const rows = await ctx.db.query("careerEvents").take(4000);
    await del(rows);
    if (rows.length < 4000) break;
  }

  const userIds: string[] = [];
  for (const { email } of [...CAREER_CAST, ...ACCOUNT_HOLDERS]) {
    const id = await demoUserId(ctx, email);
    if (id) userIds.push(id);
  }
  // ponytail: bounded takes, fine for a demo's few hundred rows.
  const profiles: Doc<"careerProfiles">[] = await ctx.db
    .query("careerProfiles")
    .withIndex("by_user", (q) => q.gte("userId", "seed-").lt("userId", "seed."))
    .take(200);
  for (const userId of userIds) {
    profiles.push(
      ...(await ctx.db
        .query("careerProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(10)),
    );
    await del(
      await ctx.db
        .query("careerBadges")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(100),
    );
    await del(
      await ctx.db
        .query("endorsements")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(100),
    );
  }

  for (const guide of profiles.filter((p) => p.kind === "guide")) {
    const crews = await ctx.db
      .query("crews")
      .withIndex("by_guide", (q) => q.eq("guideId", guide._id))
      .take(20);
    for (const crew of crews) {
      const rules = await ctx.db
        .query("crewRules")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .take(200);
      for (const rule of rules)
        await del(
          await ctx.db
            .query("ruleChoices")
            .withIndex("by_rule", (q) => q.eq("ruleId", rule._id))
            .take(200),
        );
      await del(rules);
      const days = await ctx.db
        .query("demoDays")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .take(20);
      for (const day of days)
        await del(
          await ctx.db
            .query("presentations")
            .withIndex("by_demoDay", (q) => q.eq("demoDayId", day._id))
            .take(200),
        );
      await del(days);
      await del(
        await ctx.db
          .query("crewMembers")
          .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
          .take(200),
      );
    }
    await del(crews);
  }

  for (const profile of profiles)
    count += await deleteProfileRows(ctx, profile._id);
  await del(
    await ctx.db
      .query("careerPartners")
      .withIndex("by_slug", (q) => q.eq("slug", "footscray-library"))
      .take(1),
  );
  await del(await ctx.db.query("careerDemo").take(10));
  return count;
}
