import type { MutationCtx } from "../_generated/server";
import { assertFlag } from "../app";
import { CAREER_TABLES } from "../lib/orgs/cascade";

/**
 * Spec 11.2: every row of every career table, for real and demo accounts
 * alike. Accounts survive. Demo only; the reset reseeds right after
 * (`writePivotCrews`). Returns how many rows went.
 */
export async function wipeCareers(ctx: MutationCtx): Promise<number> {
  assertFlag("demo", true);
  let count = 0;
  for (const table of CAREER_TABLES) {
    // ponytail: one transaction, fine for a demo's few hundred rows; page it if a demo outgrows it.
    const rows = await ctx.db.query(table).take(1000);
    if (rows.length === 1000)
      throw new Error(`${table} has 1000 or more rows; page wipeCareers.`);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      count++;
    }
  }
  return count;
}
