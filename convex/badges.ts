import { v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  publicQuery,
  viewerMutation,
  viewerQuery,
} from "./lib/customFunctions";
import { badgeOf } from "./lib/badges";
import { throwUserError } from "./lib/errors";
import { isPresented, savedProject } from "./lib/projects";
import { settingsOf } from "./lib/settings";
import { parts } from "./lib/sprintTime";

/**
 * The credential (15) and its public link. The badge is completion; the
 * reflection is the evidence of use, and it is the only project content that
 * ever leaves the workspace. Course progress, time, scores and the screenshot
 * never appear here (spec 7.1).
 */

const reflectionValidator = v.union(
  v.null(),
  v.object({
    project: v.string(), // the project title
    application: v.string(), // the headline (spec 3.3), or what changed without one
    shared: v.union(v.string(), v.null()), // "Shared at show and tell, 30 Sep"
  }),
);
const badgeFields = {
  name: v.string(),
  issuer: v.string(),
  completed: v.string(), // "Completed 24 September 2026"
  skills: v.array(v.string()),
  reflection: reflectionValidator,
};
const credentialValidator = v.object({ ...badgeFields, slug: v.string() });
const publicCredentialValidator = v.object({
  ...badgeFields,
  holder: v.string(), // "Dan Okafor"
});
export type Credential = Infer<typeof credentialValidator>;
export type PublicCredential = Infer<typeof publicCredentialValidator>;
type Reflection = Infer<typeof reflectionValidator>;

/** "24 September 2026" (long) or "30 Sep" (short), in the holder's time zone. */
function dateLabel(at: number, timeZone: string, month: "long" | "short") {
  const p = parts(at, timeZone, { day: "numeric", month, year: "numeric" });
  return month === "long" ? `${p.day} ${p.month} ${p.year}` : `${p.day} ${p.month}`;
}

/** The linked project, only while it is the holder's own saved project in the badge's workspace (Ruling 10). */
async function reflectionOf(
  ctx: QueryCtx,
  badge: Doc<"badges">,
  holder: Doc<"people">,
): Promise<Reflection> {
  if (!badge.reflectionProjectId) return null;
  const p = await ctx.db.get(badge.reflectionProjectId);
  if (
    !p ||
    p.personId !== holder._id ||
    p.orgId !== badge.orgId ||
    p.status !== "saved"
  ) {
    return null;
  }
  return {
    project: p.title,
    application: p.headline || p.after,
    shared: isPresented(p)
      ? `Shared at show and tell, ${dateLabel(p.presentedAt!, holder.timeZone, "short")}`
      : null,
  };
}

function credentialOf(
  badge: Doc<"badges">,
  holder: Doc<"people">,
  reflection: Reflection,
) {
  return {
    name: badge.name,
    issuer: badge.issuer,
    completed: `Completed ${dateLabel(badge.completedAt, holder.timeZone, "long")}`,
    skills: badge.skills,
    reflection,
  };
}

/** The viewer's own credential; null until the badge is issued. */
export const mine = viewerQuery()({
  args: {},
  returns: v.union(v.null(), credentialValidator),
  handler: async (ctx): Promise<Credential | null> => {
    const { person } = ctx.viewer;
    const badge = await badgeOf(ctx, person._id);
    if (!badge) return null;
    return {
      ...credentialOf(badge, person, await reflectionOf(ctx, badge, person)),
      slug: badge.shareSlug,
    };
  },
});

/** "Add to badge" (Ruling 15). */
export const attachReflection = viewerMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const { viewer } = ctx;
    const badge = await badgeOf(ctx, viewer.person._id);
    if (!badge) {
      throwUserError(
        "BADGE_MISSING",
        "Your badge appears when you finish the course.",
      );
    }
    const project = await savedProject(ctx, viewer);
    await ctx.db.patch(badge._id, { reflectionProjectId: project._id });
    return null;
  },
});

/**
 * `/credential/[slug]`, signed out. The second public read after
 * `invites.publicPreview`: the slug is the share link the holder chose to
 * pass on. The reflection shows only while the holder's
 * `reflectionsOnCredential` is on (Ruling 10).
 */
export const publicBySlug = publicQuery({
  args: { slug: v.string() },
  returns: v.union(v.null(), publicCredentialValidator),
  handler: async (ctx, { slug }): Promise<PublicCredential | null> => {
    const badge = await ctx.db
      .query("badges")
      .withIndex("by_shareSlug", (q) => q.eq("shareSlug", slug))
      .unique();
    if (!badge) return null;
    const holder = await ctx.db.get(badge.personId);
    if (!holder) return null;
    const allowed = (await settingsOf(ctx, holder._id)).reflectionsOnCredential;
    return {
      ...credentialOf(
        badge,
        holder,
        allowed ? await reflectionOf(ctx, badge, holder) : null,
      ),
      holder: holder.name,
    };
  },
});
