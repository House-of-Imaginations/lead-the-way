import { literals } from "convex-helpers/validators";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { signatureCount } from "./privacy";
import { setupSprint, currentTeam, latestSaved } from "./sprint";
import { getInOrg } from "./tenant";
import type { Viewer } from "./viewer";

/**
 * The Team AI Agreement's fixed words and limits (screen 06), and how to read
 * its versions. A new version is a new row, and versions only go up (writer
 * contract 7).
 */

/** Data that never goes into an AI tool. All on to start. */
export const NEVER_IN_DEFAULTS = [
  "Client names",
  "Personal information",
  "Passwords",
  "Confidential commercial information",
  "Unapproved customer data",
].map((label) => ({ label, on: true }));

/** The review checks. A save may switch them on or off, never rename them. */
export const CHECK_LABELS = [
  "Verify factual claims",
  "Check sources or citations",
  "Human review before client delivery",
  "Review tone and context",
  "Check calculations",
  "Check for bias or inappropriate assumptions",
] as const;

export const DEFAULT_CHECKS = CHECK_LABELS.map((label, i) => ({
  label: label as string,
  on: i < 4,
}));

export {
  MAX_ESCALATION,
  MAX_LABEL,
  MAX_NEVER_IN,
  MAX_TOOLS,
} from "./agreementLimits";

export const DEFAULT_ESCALATION =
  "Escalate uncertainty when AI output may affect a client decision, sensitive data may be involved, or an approved-tool boundary is unclear.";

/** Who to ask besides the manager, offered after the manager on 06. */
export const CONTACT_LABELS: readonly string[] = [
  "#ai-questions channel",
  "Privacy officer",
];

/** The newest version, saved or draft. */
export async function latestAgreement(ctx: QueryCtx, teamId: Id<"teams">) {
  return await ctx.db
    .query("agreements")
    .withIndex("by_team_and_version", (q) => q.eq("teamId", teamId))
    .order("desc")
    .first();
}

// Lives in lib/sprint, which the setup gate reads and this file imports.
export { latestSaved } from "./sprint";

/** "7 September", or "7 September 2026" with the year. */
export function dayMonth(
  at: number,
  timeZone: string,
  withYear = false,
): string {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(at)) {
    p[part.type] = part.value;
  }
  return withYear ? `${p.day} ${p.month} ${p.year}` : `${p.day} ${p.month}`;
}

// ponytail: a team saves a handful of versions; past this, "updated" stops
// looking further back.
const VERSIONS_READ = 50;
const PRACTISE = "Practise with de-identified or sample data.";

export const agreementForMeValidator = v.object({
  heading: v.string(),
  version: v.number(),
  tools: v.string(),
  /** The saved tools alone, for 11's row. */
  toolList: v.array(v.string()),
  neverIn: v.array(v.string()),
  practise: v.union(v.string(), v.null()),
  checks: v.array(v.string()),
  escalation: v.string(),
  contact: v.string(),
  /** The bare name, for 11. */
  contactName: v.string(),
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
 * Here, not in agreements.ts, so `me.home` reads the same rule without one
 * public module importing another (P7a Ruling 3).
 */
export async function agreementForViewer(
  ctx: QueryCtx,
  viewer: Viewer,
): Promise<AgreementForMe | null> {
  const orgId = viewer.org._id;
  const team = await currentTeam(ctx, orgId);
  const saved = team ? await latestSaved(ctx, team._id) : null;
  if (!team || !saved) return null;
  const sprint = await setupSprint(ctx, orgId);
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

  const signatures = await signatureCount(
    ctx,
    viewer.org,
    saved,
    viewer.permissions,
  );

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
    toolList: saved.tools,
    neverIn,
    practise: neverIn.length ? PRACTISE : null,
    checks: saved.checks.filter((c) => c.on).map((c) => c.label),
    escalation: saved.escalation,
    contact: `Ask ${contact}.`,
    contactName: contact,
    signatures,
    mine,
    initials: viewer.person.initials,
  };
}
