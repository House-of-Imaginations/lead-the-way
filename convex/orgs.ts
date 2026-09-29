import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  authenticatedMutation,
  authenticatedQuery,
  orgMutation,
  orgQuery,
} from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { permissionValidator, type Permission } from "./lib/orgs/permissions";
import { deleteOrg } from "./lib/orgs/cascade";
import {
  assertCanCreate,
  findSeat,
  permissionsOf,
  seatsOfUser,
} from "./lib/orgs/membership";
import { insertPerson } from "./lib/orgs/people";
import { cleanOrgName, slugIsAvailableShape, slugify } from "./lib/orgs/slug";
import { profileOf } from "./lib/account/profile";
import { setActiveOrgOf } from "./lib/account/ensureProfile";
// The workspace picture obeys the SAME rules as an account picture -- PNG/JPEG/
// WebP/GIF, under 2MB, no SVG -- so it shares the module rather than restating
// them. Two ceilings that are meant to be identical and are written down twice
// are two ceilings that will eventually differ.
import {
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  MAX_AVATAR_MB,
} from "./lib/account/avatar";

/**
 * Creating a workspace, listing the ones you are in, and reading one.
 *
 * The three gates in this file are worth telling apart:
 *
 *  - `create` and `mine` are `authenticatedQuery`/`authenticatedMutation`.
 *    There is no org to be a member of yet, so the org gate cannot apply.
 *  - everything else is `orgQuery(...)`/`orgMutation(...)`, which takes `orgId`
 *    as an argument, proves membership, and refuses without the permissions
 *    named. See `convex/lib/customFunctions.ts` for why that is a factory.
 */

const MAX_ORG_NAME = 60;

/**
 * `imageId` is absent on purpose and `imageUrl` stands in its place -- the id is
 * a handle only this backend can act on, and the URL is signed and expiring so
 * it has to be minted per read.
 */
const orgValidator = v.object({
  _id: v.id("orgs"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  createdAt: v.number(),
});

/**
 * One org row as the wire shape above. `getUrl` returns null for an id whose
 * file is gone -- a purge, a half-finished upload -- and every screen already
 * draws initials when there is no picture, so that is a state they render
 * rather than an error anybody has to handle.
 */
async function publicOrg(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  org: Doc<"orgs">,
) {
  // Named fields, not a spread: a spread would put `privacyThreshold`,
  // `isDemo` and `demoNow` in the answer and fail `orgValidator`.
  return {
    _id: org._id,
    _creationTime: org._creationTime,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt,
    imageUrl: org.imageId ? await ctx.storage.getUrl(org.imageId) : null,
  };
}

/** An org plus what the caller may do in it: one round trip per org screen. */
const seatedOrgValidator = v.object({
  org: orgValidator,
  roleName: v.string(),
  isOwner: v.boolean(),
  permissions: v.array(permissionValidator),
});

/**
 * Every workspace this person belongs to. Drives the switcher and the gate.
 *
 * An empty array is a real answer -- "you are in none" -- and it is what the
 * home route reads to decide whether to send somebody to create their first.
 */
export const mine = authenticatedQuery({
  args: {},
  returns: v.array(orgValidator),
  handler: async (ctx) => {
    const seats = await seatsOfUser(ctx, ctx.userId);

    const orgs = [];
    for (const seat of seats) {
      const org = await ctx.db.get(seat.orgId);
      // A seat pointing at an org that is gone is a broken row, not
      // something to render. Skipped rather than thrown: the switcher staying
      // usable matters more than announcing a repair job here.
      if (org) orgs.push(await publicOrg(ctx, org));
    }
    return orgs;
  },
});

/**
 * One workspace, by the slug in the URL, with the caller's own reach in it.
 *
 * Returns null rather than throwing for a slug that is not theirs, because
 * "this URL is not yours" is a screen, not an error -- the same reasoning that
 * makes `profiles.me` return null for a signed-out caller.
 */
export const bySlug = authenticatedQuery({
  args: { slug: v.string() },
  returns: v.union(v.null(), seatedOrgValidator),
  handler: async (ctx, { slug }) => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) return null;

    const seat = await findSeat(ctx, ctx.userId, org._id);
    if (!seat) return null;
    return {
      org: await publicOrg(ctx, org),
      roleName: seat.role.name,
      isOwner: seat.role.kind === "owner",
      permissions: [...seat.permissions],
    };
  },
});

/**
 * The workspace the app opens: the remembered one while the
 * caller still holds a seat there, otherwise their first, otherwise null.
 */
export const active = authenticatedQuery({
  args: {},
  returns: v.union(v.null(), seatedOrgValidator),
  handler: async (ctx) => {
    const profile = await profileOf(ctx, ctx.userId);
    const seats = await seatsOfUser(ctx, ctx.userId);
    const seat =
      seats.find((s) => s.orgId === profile?.activeOrgId) ?? seats[0];
    if (!seat) return null;
    const org = await ctx.db.get(seat.orgId);
    const role = await ctx.db.get(seat.roleId);
    if (!org || !role) return null;
    return {
      org: await publicOrg(ctx, org),
      roleName: role.name,
      isOwner: role.kind === "owner",
      permissions: [...permissionsOf(role)],
    };
  },
});

/**
 * The one starter role besides the owner. Employee holds nothing: everything
 * an employee does is their own rows, which need a seat and no permission.
 * An ordinary custom row, renamed or deleted like any other.
 */
const DEFAULT_ROLES: readonly { name: string; permissions: Permission[] }[] = [
  { name: "Employee", permissions: [] },
];

/**
 * Make a workspace, and become its owner in the same transaction.
 *
 * All three writes commit together or not at all, which is what stops an org
 * existing with no owner role, or an owner role with nobody in it. A mutation
 * is a transaction; this is the clearest reason in the codebase to care.
 *
 * THE UNIQUENESS CHECK IS NOT A RACE, though it reads like one. Convex
 * transactions are serializable and the `by_slug` range is in this
 * transaction's read set, so a second creation of the same slug conflicts with
 * this one's insert, retries, and sees the row that won.
 */
export const create = authenticatedMutation({
  args: { name: v.string() },
  returns: v.object({ orgId: v.id("orgs"), slug: v.string() }),
  handler: async (ctx, { name }) => {
    const trimmed = cleanOrgName(name);
    if (!trimmed) {
      throwUserError("ORG_NAME_REQUIRED", "A workspace needs a name.");
    }
    if (trimmed.length > MAX_ORG_NAME) {
      throwUserError(
        "ORG_NAME_REQUIRED",
        `A workspace name can be at most ${MAX_ORG_NAME} characters.`,
      );
    }

    const slug = slugify(trimmed);
    if (!slugIsAvailableShape(slug)) {
      throwUserError(
        "SLUG_TAKEN",
        "That name cannot be used as a web address. Try another.",
      );
    }

    const clash = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash) {
      throwUserError(
        "SLUG_TAKEN",
        "A workspace with that name already exists.",
      );
    }

    // Creating is the OTHER door into a workspace, and it has to hold the same
    // ceiling accepting an invitation does: `seatsOfUser` reads
    // `.take(MAX_ORGS_PER_USER)`, so a seat past the ceiling would never show.
    await assertCanCreate(ctx, ctx.userId);

    const now = Date.now();
    const orgId = await ctx.db.insert("orgs", {
      name: trimmed,
      slug,
      privacyThreshold: 5, // Task 6 replaces the literal with MIN_THRESHOLD.
      isDemo: false,
      createdAt: now,
    });
    const ownerRoleId = await ctx.db.insert("orgRoles", {
      orgId,
      kind: "owner",
      name: "Manager",
      createdAt: now,
    });
    await insertPerson(ctx, ctx.userId, orgId, ownerRoleId);

    // The new workspace is where this person is working now.
    await setActiveOrgOf(ctx, ctx.userId, orgId);

    // SEEDED, because an invitation grants a role and the owner role cannot be
    // invited into. A workspace born with only its owner role had nothing to invite
    // anybody as, so the first thing a new owner tried -- asking a colleague in
    // -- silently offered no way to do it. Ordinary custom rows: renamed,
    // edited or deleted like any role somebody made by hand.
    for (const role of DEFAULT_ROLES) {
      await ctx.db.insert("orgRoles", {
        orgId,
        kind: "custom",
        name: role.name,
        permissions: [...role.permissions],
        createdAt: now,
      });
    }

    return { orgId, slug };
  },
});

/** Rename a workspace. The slug is not touched -- links already exist. */
export const rename = orgMutation("org:manage")({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name }): Promise<null> => {
    const trimmed = cleanOrgName(name);
    if (!trimmed) {
      throwUserError("ORG_NAME_REQUIRED", "A workspace needs a name.");
    }
    if (trimmed.length > MAX_ORG_NAME) {
      throwUserError(
        "ORG_NAME_REQUIRED",
        `A workspace name can be at most ${MAX_ORG_NAME} characters.`,
      );
    }
    await ctx.db.patch(ctx.orgId, { name: trimmed });
    return null;
  },
});

/**
 * Step one of two for a workspace picture: a URL the browser may POST bytes to.
 *
 * The file never passes through a Convex function. That is not an optimisation
 * -- a mutation cannot receive a multi-megabyte argument, and an action that
 * relayed the bytes would double the transfer and put the upload inside our own
 * execution budget. The browser posts straight to storage, gets an id back, and
 * `setImage` below is what makes that id mean anything.
 *
 * Gated on `org:manage`, not merely on membership: minting upload URLs is the
 * ability to write into this deployment's storage, and every member of every
 * workspace is a much wider door than the people who may change the workspace.
 */
export const generateImageUploadUrl = orgMutation("org:manage")({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step two: adopt an uploaded file as this workspace's picture.
 *
 * THE METADATA CHECK IS THE REAL GATE. `_storage` records the type and size the
 * upload actually had, so this refuses an SVG (an image by MIME, and a
 * script-execution surface) and a file over the ceiling AFTER the bytes landed.
 * The browser-side check is a courtesy that saves a pointless upload on a phone
 * connection, not a rule -- anything the browser enforces the browser can skip.
 *
 * ORDER MATTERS, and not for tidiness. A mutation is a transaction, so
 * `throwUserError` rolls back everything the handler did INCLUDING a
 * `ctx.storage.delete`: deleting-then-throwing deletes nothing and only reads
 * as though it does. Hence the refusals come first and the swap comes last.
 */
export const setImage = orgMutation("org:manage")({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }): Promise<null> => {
    const uploaded = await ctx.db.system.get(storageId);
    if (!uploaded) {
      throwUserError(
        "ORG_IMAGE_MISSING",
        "That upload did not finish. Please try again.",
      );
    }
    if (!AVATAR_TYPES.includes(uploaded.contentType ?? "")) {
      throwUserError(
        "ORG_IMAGE_TYPE",
        "A workspace picture has to be a PNG, JPEG, WebP or GIF.",
      );
    }
    if (uploaded.size > MAX_AVATAR_BYTES) {
      throwUserError(
        "ORG_IMAGE_SIZE",
        `A workspace picture has to be under ${MAX_AVATAR_MB}MB.`,
      );
    }

    const org = await ctx.db.get(ctx.orgId);
    // The gate already proved a seat in this org, so a missing row here is a
    // race with a delete rather than a caller doing something wrong. The bytes
    // go rather than being left for nobody, and this RETURNS instead of
    // throwing so that delete actually commits.
    if (!org) {
      await ctx.storage.delete(storageId);
      return null;
    }

    const previous = org.imageId;
    await ctx.db.patch(ctx.orgId, { imageId: storageId });
    // Deleted only after the row points somewhere else, so a failure between
    // the two leaves an orphan file rather than a workspace pointing at nothing.
    if (previous) await ctx.storage.delete(previous);
    return null;
  },
});

/** Back to initials, and the bytes go with it. */
export const clearImage = orgMutation("org:manage")({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const org = await ctx.db.get(ctx.orgId);
    if (!org?.imageId) return null;

    const previous = org.imageId;
    await ctx.db.patch(ctx.orgId, { imageId: undefined });
    await ctx.storage.delete(previous);
    return null;
  },
});

/**
 * Delete a workspace and everything filed under it.
 *
 * Refused unless the caller is the OWNER, not merely somebody holding
 * `org:manage`: a custom role could be given that permission for renaming, and
 * "you may edit the name" must not quietly mean "you may end the workspace for
 * everybody in it".
 */
export const remove = orgMutation("org:manage")({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    if (ctx.role.kind !== "owner") {
      throwUserError("FORBIDDEN", "Only an owner can delete a workspace.");
    }
    await deleteOrg(ctx, ctx.orgId);
    return null;
  },
});

/** What the caller may do here. Read by screens to decide what to offer. */
export const myPermissions = orgQuery()({
  args: {},
  returns: v.array(permissionValidator),
  handler: async (ctx) => [...ctx.permissions],
});
