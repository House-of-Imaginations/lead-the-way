import { defineTable } from "convex/server";
import { v } from "convex/values";
import { permissionValidator } from "../lib/orgs/permissions";

/**
 * Organizations: the tenant every shared thing in this product hangs off.
 *
 * WHY THESE ARE HERE AND NOT IN BETTER AUTH. Better Auth ships an organization
 * plugin and it is installed. With the Convex adapter its tables live INSIDE
 * the auth component, reachable only through `authComponent.adapter(ctx)` and
 * never through `ctx.db`. A membership check is the hottest read in a
 * multi-tenant app -- it runs on every single gated call -- so it has to be an
 * index this schema owns and can compose with its own tables in one
 * transaction. The plugin's access control also gates Better Auth's own
 * endpoints rather than Convex functions, so adopting it would mean a second
 * permission model to keep in step with this one.
 *
 * It is the same split `profiles` already makes, for the same reason: auth owns
 * identity, the product owns product data.
 */

/**
 * One tenant.
 *
 * `slug` is the URL segment and the human-facing handle. It has no unique
 * constraint, because Convex has none -- uniqueness is enforced by reading
 * `by_slug` and then inserting in the same transaction. That looks like a
 * check-then-act bug and is not one: Convex transactions are serializable and
 * the index range is in the read set, so a concurrent insert of the same slug
 * conflicts, retries, and the loser sees the winner's row.
 */
export const orgTables = {
  orgs: defineTable({
    name: v.string(),
    slug: v.string(),
    /**
     * The workspace picture, as a storage handle rather than a URL.
     *
     * Same reasoning as `profiles.avatarId`: a Convex storage URL is signed and
     * expiring, so a stored one is a string going stale on its own schedule in
     * a row nobody thinks to refresh. The id is resolved to a URL at read time,
     * and no return validator a member can reach exposes the id itself.
     */
    imageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  /**
   * A role, owned by one org and invented by it.
   *
   * A UNION, NOT A BOOLEAN, and the discriminant is load-bearing. The owner
   * role carries no permissions array at all: it resolves to `ALL_PERMISSIONS`
   * in code. Had it stored today's list, adding a permission next month would
   * leave every existing owner without it -- and since the owner role may not
   * be edited, every org would be stuck behind a migration before anybody
   * could grant the new thing. This way a new permission reaches every owner on
   * deploy.
   *
   * It also makes "the owner role cannot have permissions taken away"
   * unrepresentable rather than a rule somebody has to remember to check.
   */
  orgRoles: defineTable(
    v.union(
      v.object({
        orgId: v.id("orgs"),
        kind: v.literal("owner"),
        name: v.string(),
        createdAt: v.number(),
      }),
      v.object({
        orgId: v.id("orgs"),
        kind: v.literal("custom"),
        name: v.string(),
        permissions: v.array(permissionValidator),
        createdAt: v.number(),
      }),
    ),
  ).index("by_org", ["orgId"]),

  /**
   * One person's seat in one org.
   *
   * `userId` is the Better Auth subject as a plain string, the same contract
   * every other table here keeps. NO `by_user` INDEX: a compound index on
   * `["userId", "orgId"]` already answers a query on `userId` alone, because
   * Convex indexes serve prefixes. A second index would be write amplification
   * that buys nothing.
   */
  memberships: defineTable({
    userId: v.string(),
    orgId: v.id("orgs"),
    roleId: v.id("orgRoles"),
    createdAt: v.number(),
  })
    // The gate read, on every scoped call in the product.
    .index("by_user_and_org", ["userId", "orgId"])
    // An org's member list, and the switcher's "which orgs am I in".
    .index("by_org", ["orgId"])
    // Pays for itself three times over: refusing to delete a role somebody
    // still holds, counting whether an owner would survive a demotion, and
    // being the read that makes two admins demoting each other safe under OCC.
    .index("by_role", ["roleId"]),

  /**
   * An unaccepted invitation.
   *
   * The token is the credential, stored in plaintext on purpose: a shareable
   * link has to be readable again by the admin who created it, which a hash
   * would forbid. What protects it instead is that no return validator a
   * non-admin can reach includes this column -- the same move `profiles` makes
   * with `avatarId`, and the reason `convex/notes.ts` calls a return validator
   * a leak guard rather than documentation.
   *
   * `email`, when present, is ENFORCED at accept against the account's verified
   * address. A pinned address that nothing checks would be a guarantee the
   * column only appears to make.
   */
  orgInvites: defineTable({
    orgId: v.id("orgs"),
    roleId: v.id("orgRoles"),
    token: v.string(),
    email: v.optional(v.string()),
    invitedBy: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_org", ["orgId"])
    // Deleting or widening a role revokes the invitations pinned to it, so an
    // old link cannot become a bigger grant than it was written for.
    .index("by_role", ["roleId"]),
};
