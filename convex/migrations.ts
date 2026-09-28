import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import schema from "./schema";

/**
 * The backfills.
 *
 * WHY THE COMPONENT AND NOT A ONE-OFF SCRIPT. Convex tables have no ALTER, so a
 * column added after launch is `v.optional(...)` forever and read through a
 * `??` default, unless something walks the existing rows and stamps a value on
 * them. That walk has to be resumable and batched -- a single mutation over a
 * grown table cannot commit -- which is exactly what this component does.
 *
 * `internalMutation` is passed so migrations run as internal functions and
 * inherit the app's own table types; `schema` is passed so `customRange` can
 * name a real index. Neither is optional in practice.
 *
 * Run one with `npx convex run migrations:run '{"fn":"migrations:yourMigration"}'`
 * after deploying the code that defines it.
 */
export const migrations = new Migrations(components.migrations, {
  internalMutation,
  schema,
});

export const run = migrations.runner();

/**
 * The shape a migration takes. Delete this once there is a real one.
 *
 * The handler returns a PATCH, not a whole document, and returning nothing is
 * how a row is skipped -- so a migration that has already run over a row is a
 * no-op rather than a rewrite. Keep them idempotent for that reason: a batch
 * that fails halfway is resumed, not rolled back.
 */
export const backfillDisplayName = migrations.define({
  table: "profiles",
  migrateOne: (_ctx, profile) => {
    if (profile.displayName !== "") return;
    return { displayName: "Someone" };
  },
});
