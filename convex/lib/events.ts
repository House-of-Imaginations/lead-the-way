import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { EventType } from "../tables/sprint";

/**
 * The only writer of `events` (writer contract rule 8). The product and the
 * demo script both log through here, so a click and a clock jump leave the
 * same row. `at` is the workspace clock (`viewer.now`, or the step's time).
 * Never a person id: events are read back as team totals.
 */
export async function logEvent(
  ctx: MutationCtx,
  e: {
    orgId: Id<"orgs">;
    sprintId?: Id<"sprints">;
    type: EventType;
    at: number;
    meta?: Record<string, string | number | boolean>;
  },
): Promise<void> {
  await ctx.db.insert("events", e);
}
