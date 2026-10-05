import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { nowFor } from "./lib/clock";
import { reminderEmail } from "./lib/email/messages";
import { sendEmail } from "./lib/email/send";
import { MAX_MEMBERS_PER_ORG } from "./lib/orgs/membership";
import { settingsOf } from "./lib/settings";
import { hourLong, hourStart, zoneNote } from "./lib/sprintTime";

/**
 * The day-before reminder for one week of one sprint (S-d), scheduled by
 * `sprints.launch`. Each seated person gets at most one email: in the last
 * week the show and tell reminder if that toggle is on, else the weekly one
 * if that is on. A ledger row per person makes a second run send nothing.
 * Never the demo: its people are made up and its clock is not real time.
 */
export const send = internalMutation({
  args: {
    orgId: v.id("orgs"),
    sprintId: v.id("sprints"),
    week: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { orgId, sprintId, week }): Promise<null> => {
    const org = await ctx.db.get(orgId);
    if (!org || org.isDemo) return null;
    const sprint = await ctx.db.get(sprintId);
    // Gone, another workspace's, or never launched: nothing to remind about.
    if (!sprint || sprint.orgId !== orgId || sprint.launchedAt === undefined) {
      return null;
    }
    const start = hourStart(sprint, week);
    const now = nowFor(org);
    // Late (a delayed run, or the hour has begun): a reminder now is noise.
    if (now >= start) return null;

    const link = process.env.SITE_URL
      ? `${process.env.SITE_URL}/home`
      : undefined;
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(MAX_MEMBERS_PER_ORG);
    for (const person of people) {
      // A seat with no address has nowhere to send to: no email, no ledger row.
      if (person.email === "") continue;
      const settings = await settingsOf(ctx, person._id);
      const kind =
        week === sprint.weeks && settings.showAndTellReminder
          ? "showAndTell"
          : settings.weeklyReminder
            ? "weekly"
            : null;
      if (!kind) continue;
      const had = await ctx.db
        .query("reminders")
        .withIndex("by_sprint_week_and_person", (q) =>
          q
            .eq("sprintId", sprintId)
            .eq("week", week)
            .eq("personId", person._id),
        )
        .unique();
      if (had) continue;
      const { subject, content } = reminderEmail({
        kind,
        week,
        weeks: sprint.weeks,
        when:
          hourLong(start, sprint.timeZone) +
          zoneNote(sprint.timeZone, person.timeZone),
        link,
      });
      const emailed = await sendEmail(ctx, person.email, subject, content);
      await ctx.db.insert("reminders", {
        orgId,
        sprintId,
        personId: person._id,
        week,
        kind,
        at: now,
        emailed,
      });
    }
    return null;
  },
});
