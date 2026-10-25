import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { profileOf } from "../lib/account/profile";
import { careerMutation, careerQuery } from "../lib/customFunctions";
import { throwUserError } from "../lib/errors";
import { initialsOf } from "../lib/initials";
import { crewOf, deleteRule, learnerOf, weeklyOf } from "../lib/careers/crew";

const MAX_RULE = 120;
/** Open proposals a learner may have at once (M3). */
const MAX_PROPOSALS = 3;

async function membersOf(ctx: QueryCtx | MutationCtx, crewId: Id<"crews">) {
  return await ctx.db
    .query("crewMembers")
    .withIndex("by_crew", (q) => q.eq("crewId", crewId))
    .collect();
}

/**
 * The crew a learner works in: the one they joined or, before that, the first
 * with room for their target role and its first credential.
 */
async function crewFor(
  ctx: QueryCtx | MutationCtx,
  profile: Doc<"careerProfiles">,
): Promise<Doc<"crews"> | null> {
  const joined = await crewOf(ctx, profile);
  if (joined) return joined;
  if (!profile.targetRole) return null;
  // ponytail: a scan, as there are a handful of crews; index by targetRole when there are hundreds.
  for (const crew of await ctx.db.query("crews").collect()) {
    if (crew.targetRole !== profile.targetRole) continue;
    if ((await membersOf(ctx, crew._id)).length < crew.capacity) return crew;
  }
  return null;
}

/** First name and initials only: the crew's view of a person (P2). */
async function personOf(
  ctx: QueryCtx | MutationCtx,
  profile: Doc<"careerProfiles">,
) {
  const account = await profileOf(ctx, profile.userId);
  return {
    firstName: profile.firstName,
    initials: initialsOf(account?.displayName ?? profile.firstName),
  };
}

const person = v.object({ firstName: v.string(), initials: v.string() });

/** Screen 4: the crew, its guide and its check-in. Null for a guide or with no crew. */
export const mine = careerQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      crewId: v.id("crews"),
      joined: v.boolean(),
      agreed: v.boolean(),
      guide: v.object({
        firstName: v.string(),
        initials: v.string(),
        bio: v.union(v.string(), v.null()),
      }),
      members: v.array(person),
      checkInDay: v.number(),
      checkInTime: v.string(),
      startsOn: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") return null;
    const crew = await crewFor(ctx, profile);
    if (!crew) return null;
    const rows = await membersOf(ctx, crew._id);
    const guide = await ctx.db.get(crew.guideId);
    const members = [];
    for (const row of rows) {
      const p = await ctx.db.get(row.careerProfileId);
      if (p) members.push(await personOf(ctx, p));
    }
    const me = rows.find((r) => r.careerProfileId === profile._id);
    return {
      crewId: crew._id,
      joined: me !== undefined,
      agreed: me?.agreedAt !== undefined,
      guide: {
        ...(guide
          ? await personOf(ctx, guide)
          : { firstName: "", initials: "?" }),
        bio: guide?.guideBio ?? null,
      },
      members,
      checkInDay: crew.checkInDay,
      checkInTime: crew.checkInTime,
      startsOn: crew.startsOn,
    };
  },
});

/** Whether a rule is ticked for this learner: their choice, else the rule's default. */
async function isOn(
  ctx: QueryCtx | MutationCtx,
  rule: Doc<"crewRules">,
  careerProfileId: Id<"careerProfiles">,
) {
  const choice = await ctx.db
    .query("ruleChoices")
    .withIndex("by_careerProfile_and_rule", (q) =>
      q.eq("careerProfileId", careerProfileId).eq("ruleId", rule._id),
    )
    .unique();
  return (
    choice?.on ??
    (rule.status === "active" || rule.proposedBy === careerProfileId)
  );
}

/** Screen 4's Crew Agreement: the guide's rules, then the crew's proposals. */
export const rules = careerQuery({
  args: {},
  returns: v.array(
    v.object({
      ruleId: v.id("crewRules"),
      text: v.string(),
      source: v.union(v.literal("guide"), v.literal("member")),
      on: v.boolean(),
      // "Proposed by you": a proposer is never named to anyone else.
      mine: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") return [];
    const crew = await crewFor(ctx, profile);
    if (!crew) return [];
    const all = await ctx.db
      .query("crewRules")
      .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
      .collect();
    const out = [];
    for (const rule of all) {
      if (rule.status === "declined") continue;
      out.push({
        ruleId: rule._id,
        text: rule.text,
        source: rule.source,
        on: await isOn(ctx, rule, profile._id),
        mine: rule.proposedBy === profile._id,
      });
    }
    return out;
  },
});

/**
 * P2: each crewmate's first name, initials and one word for this week, and
 * nothing at all for someone who turned off `showDoneToCrew`. The word is
 * `weeklyOf` (lib/careers/crew.ts), P2's one definition.
 */
export const status = careerQuery({
  args: {},
  returns: v.array(
    v.object({
      firstName: v.string(),
      initials: v.string(),
      status: v.union(
        v.literal("done"),
        v.literal("back"),
        v.literal("notYet"),
      ),
    }),
  ),
  handler: async (ctx) => {
    const { profile } = ctx.career;
    if (profile.kind !== "learner") return [];
    const crew = await crewOf(ctx, profile);
    if (!crew) return [];
    const now = ctx.career.now;
    const out = [];
    for (const row of await membersOf(ctx, crew._id)) {
      const settings = await ctx.db
        .query("careerSettings")
        .withIndex("by_careerProfile", (q) =>
          q.eq("careerProfileId", row.careerProfileId),
        )
        .unique();
      if (!settings?.showDoneToCrew) continue;
      const p = await ctx.db.get(row.careerProfileId);
      if (!p) continue;
      const progress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_careerProfile", (q) =>
          q.eq("careerProfileId", row.careerProfileId),
        )
        .collect();
      out.push({
        ...(await personOf(ctx, p)),
        status: weeklyOf(crew, progress, now),
      });
    }
    return out;
  },
});

/** Joins the crew `crews.mine` shows. Joining twice keeps the first. */
export const joinCrew = careerMutation({
  args: {},
  returns: v.id("crews"),
  handler: async (ctx) => {
    const profile = learnerOf(ctx.career);
    const joined = await crewOf(ctx, profile);
    if (joined) return joined._id;
    const crew = await crewFor(ctx, profile);
    if (!crew) {
      throwUserError("NOT_FOUND", "There is no crew with room yet.");
    }
    await ctx.db.insert("crewMembers", {
      crewId: crew._id,
      careerProfileId: profile._id,
      joinedAt: ctx.career.now,
    });
    return crew._id;
  },
});

/**
 * A rule of the crew the learner joined, or NOT_FOUND, so an id can't be
 * probed. Writes need a joined crew (M3); the preview before joining reads.
 */
async function ruleOf(
  ctx: MutationCtx,
  profile: Doc<"careerProfiles">,
  ruleId: Id<"crewRules">,
) {
  const crew = await crewOf(ctx, profile);
  if (!crew) throwUserError("NOT_FOUND", "Join the crew first.");
  const rule = await ctx.db.get(ruleId);
  if (
    !crew ||
    !rule ||
    rule.crewId !== crew._id ||
    rule.status === "declined"
  ) {
    throwUserError("NOT_FOUND", "That no longer exists.");
  }
  return rule;
}

export const toggleRule = careerMutation({
  args: { ruleId: v.id("crewRules"), on: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { ruleId, on }) => {
    const profile = learnerOf(ctx.career);
    await ruleOf(ctx, profile, ruleId);
    const choice = await ctx.db
      .query("ruleChoices")
      .withIndex("by_careerProfile_and_rule", (q) =>
        q.eq("careerProfileId", profile._id).eq("ruleId", ruleId),
      )
      .unique();
    if (choice) await ctx.db.patch(choice._id, { on });
    else
      await ctx.db.insert("ruleChoices", {
        ruleId,
        careerProfileId: profile._id,
        on,
      });
    return null;
  },
});

/** "Add your own rule": proposed, for the crew to vote on at the first check-in. */
export const proposeRule = careerMutation({
  args: { text: v.string() },
  returns: v.id("crewRules"),
  handler: async (ctx, args) => {
    const profile = learnerOf(ctx.career);
    const text = args.text.trim();
    if (!text) throwUserError("FIELD_REQUIRED", "Write your rule first.");
    if (text.length > MAX_RULE) {
      throwUserError(
        "FIELD_REQUIRED",
        `Keep your rule to ${MAX_RULE} characters.`,
      );
    }
    const crew = await crewOf(ctx, profile);
    if (!crew) throwUserError("NOT_FOUND", "Join the crew first.");
    const open = (
      await ctx.db
        .query("crewRules")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .take(200)
    ).filter((r) => r.proposedBy === profile._id && r.status === "proposed");
    if (open.length >= MAX_PROPOSALS) {
      throwUserError(
        "FIELD_REQUIRED",
        `You can propose up to ${MAX_PROPOSALS} rules at a time.`,
      );
    }
    return await ctx.db.insert("crewRules", {
      crewId: crew._id,
      text,
      source: "member",
      proposedBy: profile._id,
      status: "proposed",
    });
  },
});

/** Removes a rule the learner proposed, with every crewmate's choice on it. */
export const removeMyRule = careerMutation({
  args: { ruleId: v.id("crewRules") },
  returns: v.null(),
  handler: async (ctx, { ruleId }) => {
    const profile = learnerOf(ctx.career);
    const rule = await ruleOf(ctx, profile, ruleId);
    if (rule.proposedBy !== profile._id || rule.status !== "proposed") {
      throwUserError("NOT_FOUND", "That no longer exists.");
    }
    await deleteRule(ctx, ruleId);
    return null;
  },
});

/** "I agree to this Crew Agreement.", after joining. Agreeing twice keeps the first time. */
export const agree = careerMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const profile = learnerOf(ctx.career);
    const member = await ctx.db
      .query("crewMembers")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", profile._id),
      )
      .first();
    if (!member) throwUserError("NOT_FOUND", "Join the crew first.");
    if (member.agreedAt === undefined) {
      await ctx.db.patch(member._id, { agreedAt: ctx.career.now });
    }
    return null;
  },
});
