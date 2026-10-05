import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { dayMonth, latestAgreement, latestSaved } from "./lib/agreement";
import { virtualClock } from "./lib/clock";
import { timedViewerQuery, viewerMutation } from "./lib/customFunctions";
import { DEMO_CAST } from "./lib/demo/cast";
import { INVITE_MESSAGE } from "./lib/demo/script";
import { throwUserError } from "./lib/errors";
import { logEvent } from "./lib/events";
import {
  EMAIL,
  MAX_LAUNCH_INVITES,
  MAX_MESSAGE,
  normalEmail,
} from "./lib/inviteRules";
import { inviteEmailOn, sendInvite } from "./lib/orgs/email";
import {
  MAX_INVITES_PER_ORG,
  insertInvite,
  inviteRoleOf,
  livePending,
} from "./lib/orgs/invites";
import { MAX_MEMBERS_PER_ORG } from "./lib/orgs/membership";
import { reserveRateLimit } from "./lib/rateLimits";
import {
  HOUR_STARTS,
  isOneOf,
  MAX_DETAIL,
  NOT_READY_REASONS,
  TEAM_HOURS,
  TEAM_SIZES,
} from "./lib/setupOptions";
import {
  currentSprint,
  currentTeam,
  ensureSprint,
  gateOpen,
  requireDraft,
  setupGate,
  sprintInvites,
} from "./lib/sprint";
import {
  addDays,
  closesAt,
  hourEnd,
  hourPattern,
  hourStart,
  mondayOf,
  nextMonthDate,
  spanLabel,
  sprintPhase,
  startDateOf,
} from "./lib/sprintTime";
import type { Viewer } from "./lib/viewer";

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
export const current = timedViewerQuery("sprint:manage")({
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
    const startDate = startDateOf(sprint, viewer.now);
    return {
      sprintId: sprint._id,
      weekday: sprint.protectedHour.weekday,
      start: sprint.protectedHour.start,
      durationMinutes: sprint.protectedHour.durationMinutes,
      weeks: sprint.weeks,
      timeZone: sprint.timeZone,
      startDate,
      // `startDate` is week one's hour day; its week starts on the Monday before.
      weekOneMonday: mondayOf(startDate),
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
      // The day moves within week one's week: the next working week (Ruling
      // 17), or the month "Run another sprint" pinned (P7a Ruling 14). 04's
      // preview draws the same date from `weekOneMonday`.
      startDate: addDays(
        mondayOf(startDateOf(sprint, viewer.now)),
        weekday - 1,
      ),
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
    // first commit.
    const logged = await ctx.db
      .query("events")
      .withIndex("by_sprint_and_type", (q) =>
        q.eq("sprintId", sprint._id).eq("type", "hour.committed"),
      )
      .first();
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

const linkValidator = v.object({ email: v.string(), token: v.string() });

/** 07: the gate, the invitation list and the summary. Null before a sprint. */
export const launchPage = timedViewerQuery("sprint:manage")({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      launched: v.boolean(),
      /** `launch` also needs members:manage. */
      canInvite: v.boolean(),
      gate: v.object({
        committed: v.boolean(),
        pathwayDone: v.boolean(),
        agreementSaved: v.boolean(),
      }),
      suggested: v.array(v.string()),
      invited: v.array(
        v.object({
          email: v.string(),
          status: literals("pending", "accepted", "declined", "revoked"),
        }),
      ),
      message: v.string(),
      links: v.union(v.null(), v.array(linkValidator)),
      summary: v.object({
        hour: v.string(),
        runs: v.string(),
        course: v.string(),
        showAndTell: v.string(),
        agreementSaved: v.union(v.null(), v.string()),
      }),
    }),
  ),
  handler: async (ctx) => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;
    const [team, sprint] = await Promise.all([
      currentTeam(ctx, orgId),
      currentSprint(ctx, orgId),
    ]);
    if (!team || !sprint) return null;
    const isDemo = viewer.org.isDemo;
    const tz = sprint.timeZone;
    const dated = { ...sprint, startDate: startDateOf(sprint, viewer.now) };
    const last = hourStart(dated, sprint.weeks);
    const savedAt = (await latestSaved(ctx, team._id))?.savedAt;
    const gate = await setupGate(ctx, viewer, team, sprint);
    const mine = await sprintInvites(ctx, orgId, sprint._id);
    // Tokens only to whoever may hand them out, and only when nothing was
    // mailed (Ruling 30). ponytail: a demo address in a real workspace that
    // sent nothing gets its link from `launch`'s return, not from here.
    const canInvite = viewer.permissions.includes("members:manage");
    const showLinks = canInvite && (isDemo || !inviteEmailOn());
    return {
      launched: sprint.launchedAt !== undefined,
      canInvite,
      // 07 shows three of the four; the team profile isn't a launch step.
      gate: {
        committed: gate.committed,
        pathwayDone: gate.pathwayDone,
        agreementSaved: gate.agreementSaved,
      },
      // The demo's list and message are 07's; a real workspace starts empty.
      suggested: isDemo
        ? DEMO_CAST.filter((p) => p.key !== "priya").map((p) => p.email)
        : [],
      invited: mine.map((i) => ({ email: i.email, status: i.status })),
      message: sprint.inviteMessage ?? (isDemo ? INVITE_MESSAGE : ""),
      links: showLinks
        ? mine
            .filter((i) => i.status === "pending")
            .map((i) => ({ email: i.email, token: i.token }))
        : null,
      summary: {
        hour: hourPattern(
          sprint.protectedHour.weekday,
          sprint.protectedHour.start,
          sprint.protectedHour.durationMinutes,
        ),
        runs: spanLabel(hourStart(dated, 1), last, tz),
        course: sprint.courseTitle,
        showAndTell: `Show and tell, ${dayMonth(last, tz)}`,
        agreementSaved:
          savedAt === undefined ? null : `Saved ${dayMonth(savedAt, tz)}`,
      },
    };
  },
});

/**
 * "Send invitations" (07). Launches the sprint and invites each new address
 * once. The count is the invitations created; addresses already invited or
 * already members are skipped (Ruling 29).
 */
export const launch = viewerMutation(
  "sprint:manage",
  "members:manage",
)({
  args: { emails: v.array(v.string()), message: v.string() },
  returns: v.object({
    invited: v.number(),
    emailed: v.number(),
    links: v.array(linkValidator),
  }),
  handler: async (ctx, args) => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;
    // Before any write, so a refusal costs nothing (Ruling 5).
    await reserveRateLimit(ctx, "orgInvite", viewer.userId);

    const [team, sprint] = await Promise.all([
      currentTeam(ctx, orgId),
      currentSprint(ctx, orgId),
    ]);
    // A stale 07 in a second tab: say it launched, not that it isn't ready.
    if (sprint) requireDraft(sprint);
    if (
      !team ||
      !sprint ||
      !gateOpen(await setupGate(ctx, viewer, team, sprint))
    ) {
      throwUserError(
        "LAUNCH_NOT_READY",
        "Protect the hour, finish the pathway and save the agreement first.",
      );
    }

    // Normalised as `isDemoAddress` reads them, so a trailing dot can't slip
    // a demo address past it.
    const emails = [...new Set(args.emails.map(normalEmail).filter(Boolean))];
    if (emails.length === 0) {
      throwUserError("FIELD_REQUIRED", "Add at least one email address.");
    }
    if (emails.length > MAX_LAUNCH_INVITES) {
      throwUserError(
        "FIELD_REQUIRED",
        `You can invite at most ${MAX_LAUNCH_INVITES} people at once.`,
      );
    }
    if (!emails.every((e) => EMAIL.test(e))) {
      throwUserError(
        "FIELD_REQUIRED",
        "Check the email addresses and try again.",
      );
    }
    const message = args.message.trim() || undefined;
    if (message && message.length > MAX_MESSAGE) {
      throwUserError(
        "FIELD_REQUIRED",
        `A message can be at most ${MAX_MESSAGE} characters.`,
      );
    }
    // Before any write too: never a role that grants anything.
    const role = await inviteRoleOf(ctx, orgId);
    const now = viewer.now;

    // Members and live invitations are skipped. A lapsed one isn't: its
    // address gets a fresh invitation. Both sides normalised (Ruling 4), so a
    // row stored before it with a trailing dot still matches.
    const skip = new Set<string>();
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(MAX_MEMBERS_PER_ORG);
    for (const person of people) skip.add(normalEmail(person.email));
    const pending = await livePending(ctx, orgId, now);
    for (const invite of pending) {
      if (invite.email) skip.add(normalEmail(invite.email));
    }
    const fresh = emails.filter((email) => !skip.has(email));
    // The same cap `invites.create` holds.
    if (pending.length + fresh.length > MAX_INVITES_PER_ORG) {
      throwUserError(
        "FIELD_REQUIRED",
        "There are too many invitations open. Revoke some first.",
      );
    }

    // Week one as 04 and 07 show it now (Ruling 17), stored for good.
    await ctx.db.patch(sprint._id, {
      startDate: startDateOf(sprint, now),
      launchedAt: now,
      inviteMessage: message,
    });
    await logEvent(ctx, {
      orgId,
      sprintId: sprint._id,
      type: "sprint.launched",
      at: now,
    });
    // Each week's team totals are frozen when its hour ends (Ruling 2). On a
    // virtual clock a real `runAt` would fire at once, so `moveClock` takes
    // them instead. Each run makes good a missed earlier one; the last week
    // has nothing after it, so one more run when the sprint closes backs it
    // up and takes the outcomes row (P7a Ruling 9).
    if (!virtualClock(viewer.org)) {
      const stored = { ...sprint, startDate: startDateOf(sprint, now) };
      const args = { orgId, sprintId: sprint._id };
      for (let week = 1; week <= sprint.weeks; week++) {
        await ctx.scheduler.runAt(
          hourEnd(stored, week),
          internal.snapshots.take,
          args,
        );
      }
      await ctx.scheduler.runAt(
        closesAt(stored),
        internal.snapshots.take,
        args,
      );
    }

    let invited = 0;
    let emailed = 0;
    const links: { email: string; token: string }[] = [];
    for (const email of fresh) {
      const { inviteId, token } = await insertInvite(ctx, {
        orgId,
        roleId: role._id,
        email,
        sprintId: sprint._id,
        message,
        invitedBy: viewer.userId,
        at: now,
      });
      invited++;
      // The demo workspace never sends (Ruling 5): its links are copied.
      const sent =
        !viewer.org.isDemo &&
        (await sendInvite(ctx, {
          to: email,
          orgName: viewer.org.name,
          roleName: role.name,
          inviterName: viewer.person.name || "Someone",
          token,
          message,
          senderId: viewer.userId,
        }));
      if (sent) {
        emailed++;
        await ctx.db.patch(inviteId, { sentAt: now });
      } else {
        links.push({ email, token });
      }
    }
    return { invited, emailed, links };
  },
});

/**
 * 16's "Run another sprint" (P7a Ruling 14). Once the newest sprint has closed
 * and its outcomes are stored, a draft copy opens setup at 04. It keeps the
 * same team, course, length and hour, from the first such weekday of next
 * month. The newest saved agreement becomes a draft version, so 06 opens on it
 * while employees keep reading the saved one. There are no invitations and no
 * new team row: 07 invites again. It logs nothing; launching does.
 */
export const runAnother = viewerMutation("sprint:manage")({
  args: {},
  returns: v.object({ href: v.string() }),
  handler: async (ctx): Promise<{ href: string }> => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;
    // `now` is a getter that reads the clock; read it once.
    const now = viewer.now;
    const sprint = await currentSprint(ctx, orgId);
    if (sprint && sprint.launchedAt === undefined) {
      throwUserError(
        "SPRINT_DRAFT_EXISTS",
        "Your next sprint is already in setup.",
      );
    }
    const outcomes = sprint
      ? await ctx.db
          .query("sprintOutcomes")
          .withIndex("by_sprint", (q) => q.eq("sprintId", sprint._id))
          .unique()
      : null;
    if (!sprint || closesAt(sprint) > now || !outcomes) {
      throwUserError(
        "SPRINT_NOT_CLOSED",
        "You can run another sprint once this one has closed.",
      );
    }
    await ctx.db.insert("sprints", {
      orgId,
      teamId: sprint.teamId,
      startDate: nextMonthDate(
        sprint.protectedHour.weekday,
        now,
        sprint.timeZone,
      ),
      timeZone: sprint.timeZone,
      weeks: sprint.weeks,
      protectedHour: sprint.protectedHour,
      courseTitle: sprint.courseTitle,
      createdAt: now,
    });
    const saved = await latestSaved(ctx, sprint.teamId);
    const latest = await latestAgreement(ctx, sprint.teamId);
    // A draft already on top is the one 06 opens; only a saved one is copied.
    if (saved && latest?._id === saved._id) {
      await ctx.db.insert("agreements", {
        orgId,
        teamId: saved.teamId,
        version: saved.version + 1,
        status: "draft",
        tools: saved.tools,
        neverIn: saved.neverIn,
        checks: saved.checks,
        escalation: saved.escalation,
        contact: saved.contact,
      });
    }
    return { href: "/setup/protected-hour" };
  },
});
