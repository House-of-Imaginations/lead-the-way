import { v } from "convex/values";
import { publicQuery } from "../lib/customFunctions";
import { MIN_THRESHOLD } from "../lib/privacy";

/**
 * Partners (libraries, TAFEs, career events) exist for attribution and
 * anonymous totals only. Both functions answer signed out: a partner has no
 * account, and its page is public.
 */

const total = v.union(v.literal("hidden"), v.number());

/** 1 Discover: the partner a `/p/[partner]` link names, or null. */
export const bySlug = publicQuery({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({ name: v.string(), kind: v.string() })),
  handler: async (ctx, { slug }) => {
    const partner = await ctx.db
      .query("careerPartners")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return partner && { name: partner.name, kind: partner.kind };
  },
});

/**
 * P4: counts over the learners who arrived through the partner and turned
 * `researchOptIn` on. Any count below 5 is "hidden". No names, no rows per
 * person and no dates at all, so nothing is finer than a month.
 */
export const totals = publicQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      mapsBuilt: total,
      accounts: total,
      crewsJoined: total,
      credentialsEarned: total,
    }),
  ),
  handler: async (ctx, { slug }) => {
    const partner = await ctx.db
      .query("careerPartners")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!partner) return null;
    // ponytail: a scan of the partner's learners; an aggregate component if a partner reaches thousands.
    const profiles = await ctx.db
      .query("careerProfiles")
      .withIndex("by_partner", (q) => q.eq("partnerId", partner._id))
      .take(1000);
    const counted = [];
    for (const p of profiles) {
      if (p.kind !== "learner") continue;
      const settings = await ctx.db
        .query("careerSettings")
        .withIndex("by_careerProfile", (q) => q.eq("careerProfileId", p._id))
        .first();
      if (!settings?.researchOptIn) continue;
      const [member, badges] = await Promise.all([
        ctx.db
          .query("crewMembers")
          .withIndex("by_careerProfile", (q) => q.eq("careerProfileId", p._id))
          .first(),
        ctx.db
          .query("careerBadges")
          .withIndex("by_user", (q) => q.eq("userId", p.userId))
          .take(20),
      ]);
      counted.push({ p, joined: member !== null, badges: badges.length });
    }
    const shown = (n: number) => (n < MIN_THRESHOLD ? ("hidden" as const) : n);
    return {
      mapsBuilt: shown(counted.filter((c) => c.p.targetRole).length),
      accounts: shown(counted.length),
      crewsJoined: shown(counted.filter((c) => c.joined).length),
      // Hidden by people, not badges: five badges could be two people's.
      credentialsEarned:
        counted.filter((c) => c.badges > 0).length < MIN_THRESHOLD
          ? ("hidden" as const)
          : counted.reduce((n, c) => n + c.badges, 0),
    };
  },
});
