import { literals } from "convex-helpers/validators";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { PATHWAY_MODULES } from "./pathwayModules";

export { PATHWAY_MODULES, type ModuleKey } from "./pathwayModules";

export const moduleKeyValidator = literals(
  ...PATHWAY_MODULES.map((m) => m.key),
);

const COACHING = PATHWAY_MODULES.filter((m) => m.pathway === "coaching");
const COACHING_MINUTES = COACHING.reduce((sum, m) => sum + m.minutes, 0);

/**
 * How much of the coaching path is watched, 0 to 100 (Ruling 6). Required
 * minutes never count, and no module counts past its own length.
 */
export function coachingPercent(rows: Doc<"pathwayProgress">[]): number {
  let minutes = 0;
  for (const m of COACHING) {
    const row = rows.find((r) => r.moduleKey === m.key);
    minutes += Math.min(row?.minutesWatched ?? 0, m.minutes);
  }
  return Math.round((100 * minutes) / COACHING_MINUTES);
}

/** Every required module completed: the launch gate and the checklist step. */
export async function requiredDone(
  ctx: QueryCtx,
  personId: Id<"people">,
): Promise<boolean> {
  for (const m of PATHWAY_MODULES) {
    if (m.pathway !== "required") continue;
    const row = await ctx.db
      .query("pathwayProgress")
      .withIndex("by_person_and_module", (q) =>
        q.eq("personId", personId).eq("moduleKey", m.key),
      )
      .unique();
    if (row?.completedAt === undefined) return false;
  }
  return true;
}
