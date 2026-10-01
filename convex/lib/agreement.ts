import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

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

/** The newest saved version. A newer draft on top doesn't count. */
export async function latestSaved(ctx: QueryCtx, teamId: Id<"teams">) {
  const versions = ctx.db
    .query("agreements")
    .withIndex("by_team_and_version", (q) => q.eq("teamId", teamId))
    .order("desc");
  for await (const version of versions) {
    if (version.status === "saved") return version;
  }
  return null;
}

/** Any saved version counts, even with a newer draft on top. */
export async function agreementSaved(
  ctx: QueryCtx,
  team: Doc<"teams">,
): Promise<boolean> {
  return (await latestSaved(ctx, team._id)) !== null;
}

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
