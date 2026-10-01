import { literals } from "convex-helpers/validators";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * The manager pathway, "Leading AI at Work". Content, not user data, so it is a
 * constant and not a table: nobody edits it at run time. The required modules
 * are from `docs/design/data-model.md`; the four coaching titles are drafts
 * for review. The coaching path is 60 minutes, so 39 minutes is the 65%.
 */
export const PATHWAY_MODULES = [
  {
    key: "shared-norms",
    pathway: "required",
    title: "Why your team needs shared AI norms",
    minutes: 5,
  },
  {
    key: "without-micromanaging",
    pathway: "required",
    title: "Supporting AI learning without micromanaging",
    minutes: 10,
  },
  {
    key: "team-agreement",
    pathway: "required",
    title: "Creating your Team AI Agreement",
    minutes: 10,
  },
  {
    key: "coaching-conversations",
    pathway: "coaching",
    title: "Starting honest conversations about AI use",
    minutes: 15,
  },
  {
    key: "coaching-first-task",
    pathway: "coaching",
    title: "Coaching a first real task",
    minutes: 15,
  },
  {
    key: "coaching-feedback",
    pathway: "coaching",
    title: "Giving feedback on AI-assisted work",
    minutes: 15,
  },
  {
    key: "coaching-habit",
    pathway: "coaching",
    title: "Keeping the habit after the sprint",
    minutes: 15,
  },
] as const;

export type ModuleKey = (typeof PATHWAY_MODULES)[number]["key"];

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
