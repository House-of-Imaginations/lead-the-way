import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { throwUserError } from "./errors";

/** The tables whose documents carry `orgId`: every tenant row. */
type OrgTable = {
  [T in TableNames]: Doc<T> extends { orgId: Id<"orgs"> } ? T : never;
}[TableNames];

/**
 * A document named by a client, loaded only if it is in `orgId`'s workspace.
 * Any id from `args` goes through here: a plain `ctx.db.get` on one would read
 * another tenant's row. Missing and elsewhere read the same, so probing an id
 * learns nothing.
 */
export async function getInOrg<T extends OrgTable>(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
  id: Id<T>,
): Promise<Doc<T>> {
  const doc = (await ctx.db.get(id)) as (Doc<T> & { orgId: Id<"orgs"> }) | null;
  if (!doc || doc.orgId !== orgId) {
    throwUserError("NOT_FOUND", "That no longer exists.");
  }
  return doc;
}
