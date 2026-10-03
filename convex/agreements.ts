import { literals } from "convex-helpers/validators";
import { v, type Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
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
import { timedViewerQuery, viewerMutation } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { logEvent } from "./lib/events";
import { signatureCount } from "./lib/privacy";
import { currentSprint, currentTeam } from "./lib/sprint";
import { hourStart, startDateOf } from "./lib/sprintTime";
import { getInOrg } from "./lib/tenant";
import type { Viewer } from "./lib/viewer";
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

// ponytail: a team saves a handful of versions; past this, "updated" stops
// looking further back.
const VERSIONS_READ = 50;
const PRACTISE = "Practise with de-identified or sample data.";

const agreementForMeValidator = v.object({
  heading: v.string(),
  version: v.number(),
  tools: v.string(),
  neverIn: v.array(v.string()),
  practise: v.union(v.string(), v.null()),
  checks: v.array(v.string()),
  escalation: v.string(),
  contact: v.string(),
  /** Null for a team:insights holder and below the threshold. */
  signatures: v.union(
    v.null(),
    v.object({ signed: v.number(), of: v.number() }),
  ),
  /** "updated": signed an older version, not this one (spec 3.3). */
  mine: literals("unsigned", "signed", "updated"),
  initials: v.string(),
});
export type AgreementForMe = Infer<typeof agreementForMeValidator>;

/**
 * 10: the latest saved agreement as anyone seated reads it, and where they
 * stand. Ruling 1: a count, never a list, so it can't say who hasn't signed.
 */
export const forMe = timedViewerQuery()({
  args: {},
  returns: v.union(v.null(), agreementForMeValidator),
  handler: (ctx) => agreementForViewer(ctx, ctx.viewer),
});

/**
 * The body of `forMe`, exported so `me.home` (Task 7) reads the same rule
 * without a nested `ctx.runQuery` (a plain helper is what the Convex
 * guidelines prefer).
 */
export async function agreementForViewer(
  ctx: QueryCtx,
  viewer: Viewer,
): Promise<AgreementForMe | null> {
  const orgId = viewer.org._id;
  const team = await currentTeam(ctx, orgId);
  const saved = team ? await latestSaved(ctx, team._id) : null;
  if (!team || !saved) return null;
  const sprint = await currentSprint(ctx, orgId);
  const tz = sprint?.timeZone ?? viewer.person.timeZone;

  const signedOn = (a: Pick<Doc<"agreements">, "_id" | "version">) =>
    ctx.db
      .query("agreementSignatures")
      .withIndex("by_agreement_version_and_person", (q) =>
        q
          .eq("agreementId", a._id)
          .eq("version", a.version)
          .eq("personId", viewer.person._id),
      )
      .unique();
  let mine: AgreementForMe["mine"] = (await signedOn(saved))
    ? "signed"
    : "unsigned";
  if (mine === "unsigned") {
    const older = await ctx.db
      .query("agreements")
      .withIndex("by_team_and_version", (q) =>
        q.eq("teamId", team._id).lt("version", saved.version),
      )
      .order("desc")
      .take(VERSIONS_READ);
    for (const a of older) {
      if (await signedOn(a)) {
        mine = "updated";
        break;
      }
    }
  }

  // A team:insights holder reads the overview, which never lets a number
  // out (manager Ruling 15); this read must not hand it one.
  const signatures = viewer.permissions.includes("team:insights")
    ? null
    : await signatureCount(ctx, viewer.org, saved);

  // ponytail: a contact who has left reads as the manager, as 06 does.
  const contact =
    saved.contact.kind === "person"
      ? await getInOrg(ctx, orgId, saved.contact.personId).then(
          (p) => p.name,
          () => "your manager",
        )
      : saved.contact.label;
  const neverIn = saved.neverIn.filter((t) => t.on).map((t) => t.label);
  return {
    heading: `${team.name}, agreed ${dayMonth(saved.savedAt ?? saved._creationTime, tz, true)}`,
    version: saved.version,
    tools: saved.tools.length
      ? `${saved.tools.join(", ")}. Anything else, ask first.`
      : "No tools agreed yet. Ask before you use one.",
    neverIn,
    practise: neverIn.length ? PRACTISE : null,
    checks: saved.checks.filter((c) => c.on).map((c) => c.label),
    escalation: saved.escalation,
    contact: `Ask ${contact}.`,
    signatures,
    mine,
    initials: viewer.person.initials,
  };
}

/**
 * Sign the latest saved version, the one the page showed. One signature per
 * (agreement, version, person) (writer contract), logged as the script's
 * `sign` logs it. Signing twice is a double tap, not an error.
 */
export const sign = viewerMutation()({
  args: { version: v.number() },
  returns: v.null(),
  handler: async (ctx, { version }): Promise<null> => {
    const { viewer } = ctx;
    const orgId = viewer.org._id;
    const team = await currentTeam(ctx, orgId);
    const saved = team ? await latestSaved(ctx, team._id) : null;
    if (!saved) {
      throwUserError(
        "AGREEMENT_NOT_SAVED",
        "Your team's agreement isn't saved yet.",
      );
    }
    if (saved.version !== version) {
      throwUserError(
        "AGREEMENT_CHANGED",
        "The agreement changed while you were reading. Read the new version, then sign.",
      );
    }
    const had = await ctx.db
      .query("agreementSignatures")
      .withIndex("by_agreement_version_and_person", (q) =>
        q
          .eq("agreementId", saved._id)
          .eq("version", saved.version)
          .eq("personId", viewer.person._id),
      )
      .unique();
    if (had) return null;
    await ctx.db.insert("agreementSignatures", {
      orgId,
      agreementId: saved._id,
      version: saved.version,
      personId: viewer.person._id,
      signedAt: viewer.now,
    });
    const sprint = await currentSprint(ctx, orgId);
    await logEvent(ctx, {
      orgId,
      sprintId: sprint?._id,
      type: "agreement.signed",
      at: viewer.now,
      meta: { version: saved.version },
    });
    return null;
  },
});

export const current = timedViewerQuery("sprint:manage")({
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
