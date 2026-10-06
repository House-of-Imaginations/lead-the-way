import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { permissionValidator } from "../lib/orgs/permissions";

/**
 * Organizations: the tenant every shared thing in this product hangs off.
 *
 * WHY THESE ARE HERE AND NOT IN BETTER AUTH. Better Auth ships an organization
 * plugin and it is installed. With the Convex adapter its tables live INSIDE
 * the auth component, reachable only through `authComponent.adapter(ctx)` and
 * never through `ctx.db`. A seat check is the hottest read in a
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
     * A Convex storage URL is signed and
     * expiring, so a stored one is a string going stale on its own schedule in
     * a row nobody thinks to refresh. The id is resolved to a URL at read time,
     * and no return validator a member can reach exposes the id itself.
     */
    imageId: v.optional(v.id("_storage")),
    // The company's email domain and the partner that brought it in. Shown on
    // the invitation and in settings; neither grants anything.
    domain: v.optional(v.string()),
    partnerName: v.optional(v.string()),
    // Aggregates built from fewer responses than this are hidden. Never below
    // 5, whatever this says: `thresholdOf` in `convex/lib/privacy.ts` clamps it.
    privacyThreshold: v.number(),
    // 18's Sprint defaults (P7b-2): the day, start and zone a new sprint
    // starts from, and an open draft takes. Absent until saved:
    // `sprintDefaultsOf` in lib/sprint.ts falls back.
    sprintDefaults: v.optional(
      v.object({
        weekday: v.number(),
        start: v.string(),
        timeZone: v.string(),
      }),
    ),
    // The seeded Calder Lane workspace. Only a demo workspace has a script, and
    // only there does `demoNow` replace real time (`nowFor` in `lib/clock.ts`).
    isDemo: v.boolean(),
    demoNow: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_imageId", ["imageId"]),

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
   * One person's seat in one workspace, and how they appear in it.
   *
   * `name`, `initials` and `email` are copied in at join, so a manager's view
   * reads this table and never another person's account or profile. `userId`
   * is the Better Auth subject as a plain string. NO `by_user` INDEX: the
   * compound index serves a query on `userId` alone.
   */
  people: defineTable({
    userId: v.string(),
    orgId: v.id("orgs"),
    roleId: v.id("orgRoles"),
    name: v.string(),
    initials: v.string(),
    email: v.string(),
    jobTitle: v.string(),
    timeZone: v.string(),
    createdAt: v.number(),
  })
    // The gate read, on every scoped call in the product.
    .index("by_user_and_org", ["userId", "orgId"])
    // A workspace's people, and the switcher's "which workspaces am I in".
    .index("by_org", ["orgId"])
    // Refusing to delete a held role, counting surviving owners, and the read
    // that makes two admins demoting each other safe under OCC.
    .index("by_role", ["roleId"]),

  /**
   * An invitation. The row outlives its answer: `status` records what
   * happened, so a link opened twice can say "already used" or "withdrawn"
   * instead of "not valid", and the launch screen can show who has joined.
   */
  orgInvites: defineTable({
    orgId: v.id("orgs"),
    roleId: v.id("orgRoles"),
    token: v.string(),
    /** Pinned: only an account with this address (lowercased) may accept. */
    email: v.optional(v.string()),
    /** Who it is for, as the manager typed it. Shown on the invitation. */
    name: v.optional(v.string()),
    sprintId: v.optional(v.id("sprints")),
    message: v.optional(v.string()),
    status: literals("pending", "accepted", "declined", "revoked"),
    /** The seat it became, once accepted. */
    personId: v.optional(v.id("people")),
    invitedBy: v.string(),
    sentAt: v.optional(v.number()),
    respondedAt: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    // Live pending only, exactly: the cap and the list read past `now`, so a
    // lapsed row never takes a place in the range. Its prefixes serve one
    // answered status at a time, and "all of them" for a workspace.
    .index("by_org_status_and_expiresAt", ["orgId", "status", "expiresAt"])
    // First sign-in: is there a live invitation for this address? (R8)
    .index("by_email_status_and_expiresAt", ["email", "status", "expiresAt"])
    // Revoking what a role change would otherwise silently widen.
    .index("by_role", ["roleId"]),
};
