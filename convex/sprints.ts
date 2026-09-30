import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { logEvent } from "./lib/events";
import {
  HOUR_STARTS,
  isOneOf,
  NOT_READY_REASONS,
  TEAM_HOURS,
  TEAM_SIZES,
} from "./lib/setupOptions";
import {
  currentSprint,
  currentTeam,
  ensureSprint,
  requireDraft,
} from "./lib/sprint";
import { addDays, sprintPhase, weekOneDate } from "./lib/sprintTime";
import type { Viewer } from "./lib/viewer";

/** "Something else" words in the not ready dialog. */
const MAX_DETAIL = 500;

/** "6 to 10 people, client service": 04's team line. Acronyms stay ("HR"). */
function summaryOf(sizeBand?: string, teamFunction?: string): string | null {
  const fn =
    teamFunction && teamFunction !== teamFunction.toUpperCase()
      ? teamFunction.toLowerCase()
      : teamFunction;
  const text = [sizeBand && `${sizeBand} people`, fn]
    .filter(Boolean)
    .join(", ");
  return text ? text[0]!.toUpperCase() + text.slice(1) : null;
}

/**
 * Screen 04 (and 07's summary): the current sprint's hour, where setup stands
 * and where the sprint is. Null until the first setup save makes the sprint.
 */
export const current = viewerQuery("sprint:manage")({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      sprintId: v.id("sprints"),
      weekday: v.number(),
      start: v.string(),
      durationMinutes: v.number(),
      weeks: v.number(),
      timeZone: v.string(),
      startDate: v.string(),
      weekOneMonday: v.string(),
      committed: v.boolean(),
      notReady: v.boolean(),
      launched: v.boolean(),
      phase: literals("draft", "scheduled", "active", "complete"),
      teamHours: v.union(v.null(), v.number()),
      teamSummary: v.union(v.null(), v.string()),
      courseTitle: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const { viewer } = ctx;
    const sprint = await currentSprint(ctx, viewer.org._id);
    if (!sprint) return null;
    const team = await currentTeam(ctx, viewer.org._id);
    const band = team?.sizeBand;
    // `startDate` is week one's hour day; its week starts on the Monday before.
    const day = new Date(`${sprint.startDate}T00:00:00Z`).getUTCDay();
    return {
      sprintId: sprint._id,
      weekday: sprint.protectedHour.weekday,
      start: sprint.protectedHour.start,
      durationMinutes: sprint.protectedHour.durationMinutes,
      weeks: sprint.weeks,
      timeZone: sprint.timeZone,
      startDate: sprint.startDate,
      weekOneMonday: addDays(sprint.startDate, -((day + 6) % 7)),
      committed: sprint.committedAt !== undefined,
      notReady: sprint.notReady !== undefined,
      launched: sprint.launchedAt !== undefined,
      phase: sprintPhase(sprint, viewer.now),
      teamHours: band && isOneOf(TEAM_SIZES, band) ? TEAM_HOURS[band] : null,
      teamSummary: summaryOf(band, team?.teamFunction),
      courseTitle: sprint.courseTitle,
    };
  },
});

const hourArgs = { weekday: v.number(), start: v.string() };

/** 04's choices, checked, then the draft sprint they apply to. */
async function draftFor(
  ctx: MutationCtx,
  viewer: Viewer,
  { weekday, start }: { weekday: number; start: string },
) {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 5) {
    throwUserError("FIELD_REQUIRED", "Choose a day from Monday to Friday.");
  }
  if (!isOneOf(HOUR_STARTS, start)) {
    throwUserError("FIELD_REQUIRED", "Choose a start time from the list.");
  }
  const sprint = await ensureSprint(ctx, viewer);
  requireDraft(sprint);
  return {
    sprint,
    hour: {
      protectedHour: { weekday, start, durationMinutes: 60 },
      // Week one follows the day (Ruling 17).
      startDate: weekOneDate(weekday, viewer.now, sprint.timeZone),
    },
  };
}

/** Save 04's day and time without committing (Save and exit). */
export const setProtectedHour = viewerMutation("sprint:manage")({
  args: hourArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { sprint, hour } = await draftFor(ctx, ctx.viewer, args);
    await ctx.db.patch(sprint._id, hour);
    return null;
  },
});

/**
 * "Protect this hour": saves the hour and the commitment. `committedAt` is set
 * once and kept; a later change of day keeps it. A "not ready" answer is
 * replaced by this one.
 */
export const commit = viewerMutation("sprint:manage")({
  args: hourArgs,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { viewer } = ctx;
    const { sprint, hour } = await draftFor(ctx, viewer, args);
    // "Keep exploring" clears `committedAt`, so the event is the record of a
    // first commit. ponytail: `events` only has by_org; add an index on
    // (orgId, type) if an org's event count ever makes this scan slow.
    let logged = false;
    for await (const e of ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", viewer.org._id))) {
      if (e.type === "hour.committed" && e.sprintId === sprint._id) {
        logged = true;
        break;
      }
    }
    await ctx.db.patch(sprint._id, {
      ...hour,
      committedAt: sprint.committedAt ?? viewer.now,
      notReady: undefined,
    });
    if (!logged) {
      await logEvent(ctx, {
        orgId: viewer.org._id,
        sprintId: sprint._id,
        type: "hour.committed",
        at: viewer.now,
      });
    }
    return null;
  },
});

/**
 * The "not ready" dialog (A1, Ruling 20). Either button logs the reason;
 * "Keep exploring" also records it on the sprint and withdraws a commitment.
 * The free text stays on the sprint, never in the event.
 */
export const notReady = viewerMutation("sprint:manage")({
  args: {
    reason: v.optional(v.string()),
    detail: v.optional(v.string()),
    choice: literals("keepExploring", "backToScheduling"),
  },
  returns: v.null(),
  handler: async (ctx, { reason, detail, choice }): Promise<null> => {
    const { viewer } = ctx;
    if (reason !== undefined && !isOneOf(NOT_READY_REASONS, reason)) {
      throwUserError("FIELD_REQUIRED", "Choose a reason from the list.");
    }
    const words = detail?.trim() ?? "";
    if (words.length > MAX_DETAIL) {
      throwUserError(
        "FIELD_REQUIRED",
        `Tell us more in at most ${MAX_DETAIL} characters.`,
      );
    }
    const sprint = await ensureSprint(ctx, viewer);
    requireDraft(sprint);
    await logEvent(ctx, {
      orgId: viewer.org._id,
      sprintId: sprint._id,
      type: "hour.notReady",
      at: viewer.now,
      meta: { reason: reason ?? "none", choice },
    });
    if (choice === "keepExploring") {
      await ctx.db.patch(sprint._id, {
        notReady: {
          at: viewer.now,
          reason: reason ?? "",
          detail: reason === "Something else" && words ? words : undefined,
        },
        committedAt: undefined,
      });
    }
    return null;
  },
});
