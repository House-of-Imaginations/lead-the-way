import { v } from "convex/values";
import { CREDENTIALS } from "../lib/careers/catalog";
import { learnerOf, projectFor, settingsFor } from "../lib/careers/crew";
import {
  careerMutation,
  careerQuery,
  publicQuery,
} from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { mintToken } from "../lib/orgs/invites";
import { credentialId } from "../tables/careers";

/**
 * 6 Prove it, and the public proof page. Badges and endorsements are keyed
 * by `userId` (A7). Confidence is private to the learner (P3, P5): only
 * `mine` returns it.
 */

const nameOf = (id: string) => CREDENTIALS.find((c) => c.id === id)!.name;

const guideValidator = v.object({
  firstName: v.string(),
  bio: v.union(v.null(), v.string()),
});

export const mine = careerQuery({
  args: {},
  returns: v.object({
    badges: v.array(
      v.object({ credentialId, name: v.string(), earnedAt: v.number() }),
    ),
    project: v.union(
      v.null(),
      v.object({
        credentialId,
        task: v.string(),
        whatIDid: v.string(),
        reflection: v.string(),
        skills: v.array(v.string()),
        addReflectionToProof: v.boolean(),
        reviewed: v.boolean(),
      }),
    ),
    endorsements: v.array(
      v.object({ credentialId, text: v.string(), guide: guideValidator }),
    ),
    confidence: v.array(v.object({ credentialId, value: v.number() })),
    links: v.array(v.object({ credentialId, slug: v.string() })),
  }),
  handler: async (ctx) => {
    const profile = learnerOf(ctx.career);
    const { userId } = ctx.career;
    const [badges, project, endorsements, confidence, links] =
      await Promise.all([
        ctx.db
          .query("careerBadges")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(20),
        projectFor(ctx, profile._id),
        ctx.db
          .query("endorsements")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(20),
        ctx.db
          .query("confidence")
          .withIndex("by_careerProfile", (q) =>
            q.eq("careerProfileId", profile._id),
          )
          .take(20),
        ctx.db
          .query("proofLinks")
          .withIndex("by_careerProfile", (q) =>
            q.eq("careerProfileId", profile._id),
          )
          .take(20),
      ]);
    return {
      badges: badges.map((b) => ({
        credentialId: b.credentialId,
        name: nameOf(b.credentialId),
        earnedAt: b.earnedAt,
      })),
      project: project && {
        credentialId: project.credentialId,
        task: project.task,
        whatIDid: project.whatIDid,
        reflection: project.reflection,
        skills: project.skills,
        addReflectionToProof: project.addReflectionToProof,
        reviewed: project.reviewedAt !== undefined,
      },
      endorsements: await Promise.all(
        endorsements.map(async (e) => {
          const guide = await ctx.db.get(e.guideId);
          return {
            credentialId: e.credentialId,
            text: e.text,
            guide: {
              firstName: guide?.firstName ?? "",
              bio: guide?.guideBio ?? null,
            },
          };
        }),
      ),
      confidence: confidence.map((c) => ({
        credentialId: c.credentialId,
        value: c.value,
      })),
      links: links.map((l) => ({ credentialId: l.credentialId, slug: l.slug })),
    };
  },
});

/** The Test Card measure: 1 to 5, one rating per credential, private. */
export const rateConfidence = careerMutation({
  args: { credentialId, value: v.number() },
  returns: v.null(),
  handler: async (ctx, { credentialId, value }) => {
    const profile = learnerOf(ctx.career);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throwUserError("FIELD_REQUIRED", "Choose a number from 1 to 5.");
    }
    const rows = await ctx.db
      .query("confidence")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .take(20);
    const row = rows.find((c) => c.credentialId === credentialId);
    const at = ctx.career.now;
    if (row) await ctx.db.patch(row._id, { value, at });
    else
      await ctx.db.insert("confidence", {
        careerProfileId: profile._id,
        credentialId,
        value,
        at,
      });
    return null;
  },
});

/** A shareable link for an earned badge. The same link comes back on a repeat. */
export const createProofLink = careerMutation({
  args: { credentialId },
  returns: v.string(),
  handler: async (ctx, { credentialId }) => {
    const profile = learnerOf(ctx.career);
    const badges = await ctx.db
      .query("careerBadges")
      .withIndex("by_user", (q) => q.eq("userId", ctx.career.userId))
      .take(20);
    if (!badges.some((b) => b.credentialId === credentialId)) {
      throwUserError("BADGE_MISSING", "Earn this badge first.");
    }
    const links = await ctx.db
      .query("proofLinks")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .take(20);
    const link = links.find((l) => l.credentialId === credentialId);
    if (link) return link.slug;
    const slug = mintToken();
    await ctx.db.insert("proofLinks", {
      careerProfileId: profile._id,
      slug,
      credentialId,
    });
    return slug;
  },
});

/**
 * `/proof/[slug]`, signed out (P5): the badge, the project's task and skills,
 * and the endorsement. The reflection only when both `reflectionOnProof` and
 * the project's `addReflectionToProof` are on. Never confidence, lessons or
 * crew. Null for a slug nobody holds (the page's 404).
 */
export const publicProof = publicQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      firstName: v.string(),
      badge: v.object({ name: v.string(), earnedAt: v.number() }),
      project: v.union(
        v.null(),
        v.object({
          task: v.string(),
          skills: v.array(v.string()),
          reflection: v.union(v.null(), v.string()),
        }),
      ),
      endorsement: v.union(
        v.null(),
        v.object({ text: v.string(), guide: guideValidator }),
      ),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const link = await ctx.db
      .query("proofLinks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const profile = link && (await ctx.db.get(link.careerProfileId));
    if (!link || !profile) return null;
    const [badges, endorsements, project, settings] = await Promise.all([
      ctx.db
        .query("careerBadges")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .take(20),
      ctx.db
        .query("endorsements")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .take(20),
      projectFor(ctx, profile._id, link.credentialId),
      settingsFor(ctx, profile._id),
    ]);
    const badge = badges.find((b) => b.credentialId === link.credentialId);
    if (!badge) return null;
    const endorsement = endorsements.find(
      (e) => e.credentialId === link.credentialId,
    );
    const guide = endorsement && (await ctx.db.get(endorsement.guideId));
    const showReflection =
      settings?.reflectionOnProof === true &&
      project?.addReflectionToProof === true;
    return {
      firstName: profile.firstName,
      badge: { name: nameOf(badge.credentialId), earnedAt: badge.earnedAt },
      project: project && {
        task: project.task,
        skills: project.skills,
        reflection: showReflection ? project.reflection : null,
      },
      endorsement: endorsement
        ? {
            text: endorsement.text,
            guide: {
              firstName: guide?.firstName ?? "",
              bio: guide?.guideBio ?? null,
            },
          }
        : null,
    };
  },
});
