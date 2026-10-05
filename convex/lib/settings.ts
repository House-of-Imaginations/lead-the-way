import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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

/**
 * A person's settings: their row, or the defaults. `writeSettings` is the only
 * writer, so there is one row at most; `.first()` keeps a read from throwing
 * on a stray second one.
 */
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

/**
 * The one writer of `settings` (writer contract 5): upsert the person's row,
 * never a second one. `.unique()` throws on a stray duplicate instead of
 * writing past it, because `loadCountable` reads `.first()` and could then
 * miss an opt-out.
 */
export async function writeSettings(
  ctx: MutationCtx,
  person: Pick<Doc<"people">, "_id" | "orgId">,
  patch: Partial<Settings>,
): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_person", (q) => q.eq("personId", person._id))
    .unique();
  if (row) {
    await ctx.db.patch(row._id, patch);
    return;
  }
  await ctx.db.insert("settings", {
    orgId: person.orgId,
    personId: person._id,
    ...DEFAULT_SETTINGS,
    ...patch,
  });
}
