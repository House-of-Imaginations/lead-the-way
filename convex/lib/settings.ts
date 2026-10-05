import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Ruling 5: what a person has with no `settings` row, as 19 shows them. */
export const DEFAULT_SETTINGS = {
  weeklyReminder: true,
  showAndTellReminder: true,
  askBeforeSharing: true,
  reflectionsOnCredential: true,
  includeInTeamTotals: true,
  captionsByDefault: true,
  reduceMotion: false,
} as const;
export type Settings = {
  -readonly [K in keyof typeof DEFAULT_SETTINGS]: boolean;
};
const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

/** A person's settings: their row, or the defaults. P6 writes none (19 is P7). */
export async function settingsOf(
  ctx: QueryCtx,
  personId: Id<"people">,
): Promise<Settings> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_person", (q) => q.eq("personId", personId))
    .first();
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (row) for (const key of KEYS) out[key] = row[key];
  return out;
}
