import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import {
  CREDENTIALS,
  CURRENT_ROLES,
  TARGETS,
  strengthsFor,
  weeksForHours,
} from "../lib/careers/catalog";
import { logCareerEvent } from "../lib/careers/writers";
import { publicMutation, publicQuery } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { mintToken } from "../lib/orgs/invites";
import { reserveRateLimit } from "../lib/rateLimits";
import { hours, targetRole } from "../tables/careers";

/**
 * The Pivot Map before an account exists (P9). Every function is by token,
 * the draft cookie's value, and answers signed out: holding the token is the
 * only key. A draft holds no name and no email, and is gone 30 days after it
 * was made (`expire`, daily from `crons.ts`) or when it is claimed.
 */
const DRAFT_DAYS = 30;
const currentRole = v.union(...CURRENT_ROLES.map((r) => v.literal(r)));

async function draftOf(ctx: QueryCtx | MutationCtx, token: string) {
  return await ctx.db
    .query("mapDrafts")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

export const get = publicQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({ currentRole: v.string(), targetRole, hoursPerWeek: hours }),
  ),
  handler: async (ctx, { token }) => {
    const draft = await draftOf(ctx, token);
    return (
      draft && {
        currentRole: draft.currentRole,
        targetRole: draft.targetRole,
        hoursPerWeek: draft.hoursPerWeek,
      }
    );
  },
});

/** Tell us: creates the draft, or updates the one `token` names. Returns its token. */
export const saveAnswers = publicMutation({
  args: {
    token: v.optional(v.string()),
    partner: v.optional(v.string()),
    currentRole,
    targetRole,
    hoursPerWeek: hours,
    consent: v.boolean(),
  },
  returns: v.string(),
  handler: async (ctx, { token, partner, consent, ...answers }) => {
    if (!consent) {
      throwUserError("FIELD_REQUIRED", "Agree to how we use your answers.");
    }
    const draft = token ? await draftOf(ctx, token) : null;
    if (draft) {
      await ctx.db.patch(draft._id, answers);
      return draft.token;
    }
    await reserveRateLimit(ctx, "mapDraft");
    const partnerId = partner
      ? (
          await ctx.db
            .query("careerPartners")
            .withIndex("by_slug", (q) => q.eq("slug", partner))
            .unique()
        )?._id
      : undefined;
    const now = Date.now();
    const fresh = mintToken();
    await ctx.db.insert("mapDrafts", {
      token: fresh,
      ...(partnerId && { partnerId }),
      ...answers,
      consentAt: now,
      createdAt: now,
    });
    await logCareerEvent(ctx, {
      name: "mapBuilt",
      at: now,
      ...(partnerId && { partnerId }),
    });
    return fresh;
  },
});

/** The Pivot Map's hours a week. Null, and nothing written, for a token with no draft. */
export const setHours = publicMutation({
  args: { token: v.string(), hoursPerWeek: hours },
  returns: v.null(),
  handler: async (ctx, { token, hoursPerWeek }) => {
    const draft = await draftOf(ctx, token);
    if (draft) await ctx.db.patch(draft._id, { hoursPerWeek });
    return null;
  },
});

const named = v.object({ id: v.string(), name: v.string() });

/** What the Pivot Map shows (screen 3): strengths, three skills, three credentials, weeks. */
export const pivotMap = publicQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      currentRole: v.string(),
      target: named,
      hoursPerWeek: hours,
      strengths: v.array(v.string()),
      note: v.string(),
      skills: v.array(
        v.object({
          name: v.string(),
          credential: named,
          jobAd: v.object({
            title: v.string(),
            place: v.string(),
            quote: v.string(),
          }),
        }),
      ),
      weeks: v.object({ total: v.number(), perCredential: v.number() }),
    }),
  ),
  handler: async (ctx, { token }) => {
    const draft = await draftOf(ctx, token);
    if (!draft) return null;
    const target = TARGETS.find((t) => t.id === draft.targetRole)!;
    return {
      currentRole: draft.currentRole,
      target: { id: target.id, name: target.name },
      hoursPerWeek: draft.hoursPerWeek,
      ...strengthsFor(draft.currentRole),
      skills: target.skills.map((s) => ({
        name: s.name,
        credential: {
          id: s.credentialId,
          name: CREDENTIALS.find((c) => c.id === s.credentialId)!.name,
        },
        jobAd: s.jobAd,
      })),
      weeks: weeksForHours(draft.hoursPerWeek),
    };
  },
});

/**
 * Sign-up's half of the draft: its answers for the new career profile, and
 * the draft deleted in the same mutation (spec 5.3). Null for no token, or a
 * token whose draft expired or was already claimed.
 */
export async function takeDraft(
  ctx: MutationCtx,
  token: string | undefined,
): Promise<Pick<
  Doc<"careerProfiles">,
  "currentRole" | "targetRole" | "hoursPerWeek" | "consentAt" | "partnerId"
> | null> {
  const draft = token ? await draftOf(ctx, token) : null;
  if (!draft) return null;
  await ctx.db.delete(draft._id);
  return {
    currentRole: draft.currentRole,
    targetRole: draft.targetRole,
    hoursPerWeek: draft.hoursPerWeek,
    consentAt: draft.consentAt,
    ...(draft.partnerId && { partnerId: draft.partnerId }),
  };
}

const BATCH = 256;

/** P9: deletes drafts older than 30 days, a batch at a time. Daily, from `crons.ts`. */
export const expire = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - DRAFT_DAYS * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("mapDrafts")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(BATCH);
    for (const draft of old) await ctx.db.delete(draft._id);
    if (old.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.careers.drafts.expire, {});
    }
    return null;
  },
});
