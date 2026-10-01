import { literals } from "convex-helpers/validators";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  CHECK_LABELS,
  CONTACT_LABELS,
  DEFAULT_CHECKS,
  DEFAULT_ESCALATION,
  MAX_ESCALATION,
  MAX_LABEL,
  MAX_NEVER_IN,
  MAX_TOOLS,
  NEVER_IN_DEFAULTS,
  dayMonth,
  latestAgreement,
  latestSaved,
} from "./lib/agreement";
import { viewerMutation, viewerQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { logEvent } from "./lib/events";
import { currentSprint, currentTeam } from "./lib/sprint";
import { hourStart, startDateOf } from "./lib/sprintTime";
import { getInOrg } from "./lib/tenant";
import { contactValidator, toggleValidator } from "./tables/sprint";

/**
 * The Team AI Agreement builder (06). No draft autosave: the page holds the
 * form until "Save agreement", and `save` decides the version (Ruling 27).
 */

type Content = Pick<
  Doc<"agreements">,
  "tools" | "neverIn" | "checks" | "escalation" | "contact"
>;

/** Equal fingerprints mean an unchanged save. */
const fingerprint = (a: Content) =>
  JSON.stringify([
    a.tools,
    a.neverIn.map((t) => [t.label, t.on]),
    a.checks.map((t) => [t.label, t.on]),
    a.escalation,
    a.contact.kind === "person"
      ? a.contact.personId
      : `label:${a.contact.label}`,
  ]);

/** A label, trimmed, 1 to `MAX_LABEL` characters. */
function labelOf(raw: string, what: string): string {
  const label = raw.trim();
  if (!label || label.length > MAX_LABEL) {
    throwUserError(
      "FIELD_REQUIRED",
      `Each ${what} needs a name of 1 to ${MAX_LABEL} characters.`,
    );
  }
  return label;
}

/** The first of each label, ignoring case, and at most `max` of them. */
function dedupe<T>(
  items: T[],
  key: (item: T) => string,
  max: number,
  what: string,
): T[] {
  const seen = new Set<string>();
  const out = items.filter((item) => {
    const k = key(item).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (out.length > max) {
    throwUserError("FIELD_REQUIRED", `You can list at most ${max} ${what}s.`);
  }
  return out;
}

export const current = viewerQuery("sprint:manage")({
  args: {},
  returns: v.object({
    status: literals("none", "draft", "saved"),
    version: v.union(v.null(), v.number()),
    savedOn: v.union(v.null(), v.string()),
    tools: v.array(v.string()),
    neverIn: v.array(toggleValidator),
    checks: v.array(toggleValidator),
    escalation: v.string(),
    contact: contactValidator,
    /** The saved person contact, who may be another manager. */
    contactPerson: v.union(
      v.null(),
      v.object({ id: v.id("people"), name: v.string() }),
    ),
    contactOptions: v.array(v.object({ value: v.string(), label: v.string() })),
    teamName: v.string(),
    dateLabel: v.string(),
    reviewDate: v.string(),
    managerInitials: v.string(),
  }),
  handler: async (ctx) => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;
    const [team, sprint] = await Promise.all([
      currentTeam(ctx, orgId),
      currentSprint(ctx, orgId),
    ]);
    const latest = team ? await latestAgreement(ctx, team._id) : null;
    const saved =
      latest?.status === "saved"
        ? latest
        : team
          ? await latestSaved(ctx, team._id)
          : null;
    const savedAt = saved?.savedAt;
    const tz = sprint?.timeZone ?? viewer.person.timeZone;
    const content: Content = latest ?? {
      tools: [],
      neverIn: NEVER_IN_DEFAULTS,
      checks: DEFAULT_CHECKS,
      escalation: DEFAULT_ESCALATION,
      contact: { kind: "person", personId: viewer.person._id },
    };
    // ponytail: a contact who has left reads as none, and 06 offers the viewer.
    const contactPerson =
      content.contact.kind === "person"
        ? await getInOrg(ctx, orgId, content.contact.personId).then(
            (p) => ({ id: p._id, name: p.name }),
            () => null,
          )
        : null;
    return {
      status: latest ? latest.status : ("none" as const),
      version: latest?.version ?? null,
      savedOn: savedAt === undefined ? null : dayMonth(savedAt, tz),
      tools: content.tools,
      neverIn: content.neverIn,
      checks: content.checks,
      escalation: content.escalation,
      contact: content.contact,
      contactPerson,
      // The person option carries the viewer's id, so the page can send it
      // back as `{ kind: "person", personId }`.
      contactOptions: [
        { value: viewer.person._id, label: viewer.person.name },
        ...CONTACT_LABELS.map((label) => ({ value: label, label })),
      ],
      teamName: team?.name ?? "",
      dateLabel: dayMonth(savedAt ?? viewer.now, tz, true),
      // Reviewed at the last week's hour. No sprint yet, no date.
      reviewDate: sprint
        ? dayMonth(
            hourStart(
              { ...sprint, startDate: startDateOf(sprint, viewer.now) },
              sprint.weeks,
            ),
            tz,
            true,
          )
        : "",
      managerInitials: viewer.person.initials,
    };
  },
});

export const save = viewerMutation("sprint:manage")({
  args: {
    tools: v.array(v.string()),
    neverIn: v.array(toggleValidator),
    checks: v.array(toggleValidator),
    escalation: v.string(),
    contact: contactValidator,
  },
  returns: v.object({ version: v.number(), changed: v.boolean() }),
  handler: async (ctx, args) => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;

    const tools = dedupe(
      args.tools.map((t) => labelOf(t, "tool")),
      (t) => t,
      MAX_TOOLS,
      "tool",
    );
    const neverIn = dedupe(
      args.neverIn.map((t) => ({ label: labelOf(t.label, "item"), on: t.on })),
      (t) => t.label,
      MAX_NEVER_IN,
      "item",
    );
    const checks = args.checks.map((c) => ({
      label: c.label.trim(),
      on: c.on,
    }));
    if (
      checks.length !== CHECK_LABELS.length ||
      checks.some((c, i) => c.label !== CHECK_LABELS[i])
    ) {
      throwUserError("FIELD_REQUIRED", "The review checks can't be renamed.");
    }
    const escalation = args.escalation.trim();
    if (escalation.length > MAX_ESCALATION) {
      throwUserError(
        "FIELD_REQUIRED",
        `The escalation rule can be at most ${MAX_ESCALATION} characters.`,
      );
    }
    if (args.contact.kind === "person") {
      // Another workspace's person is NOT_FOUND, never a contact.
      await getInOrg(ctx, orgId, args.contact.personId);
    } else if (!CONTACT_LABELS.includes(args.contact.label)) {
      throwUserError("FIELD_REQUIRED", "Pick a contact from the list.");
    }
    const content: Content = {
      tools,
      neverIn,
      checks,
      escalation,
      contact: args.contact,
    };

    const team = await currentTeam(ctx, orgId);
    if (!team) throwUserError("NOT_FOUND", "Set up your team first.");
    const now = viewer.now;
    const saved = {
      status: "saved" as const,
      savedAt: now,
      savedBy: viewer.person._id,
    };
    const latest = await latestAgreement(ctx, team._id);
    let version: number;
    if (latest?.status === "draft") {
      // A draft on top (the script, or P7's clone) is saved in place.
      version = latest.version;
      await ctx.db.patch(latest._id, { ...content, ...saved });
    } else if (latest && fingerprint(latest) === fingerprint(content)) {
      return { version: latest.version, changed: false };
    } else {
      version = (latest?.version ?? 0) + 1;
      await ctx.db.insert("agreements", {
        orgId,
        teamId: team._id,
        version,
        ...content,
        ...saved,
      });
    }
    const sprint = await currentSprint(ctx, orgId);
    await logEvent(ctx, {
      orgId,
      sprintId: sprint?._id,
      type: "agreement.saved",
      at: now,
      meta: { version },
    });
    return { version, changed: true };
  },
});
