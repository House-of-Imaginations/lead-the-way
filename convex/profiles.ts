import { v } from "convex/values";
import schema from "./schema";
import { throwUserError } from "./lib/errors";
import {
  authenticatedMutation,
  orgMutation,
  publicQuery,
} from "./lib/customFunctions";
import { MAX_DISPLAY_NAME, profileOf } from "./lib/account/profile";
import { ensureProfile, setActiveOrgOf } from "./lib/account/ensureProfile";
import {
  AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  MAX_AVATAR_MB,
} from "./lib/account/avatar";

/**
 * The product-owned half of an account.
 *
 * Better Auth owns identity -- email, password, OAuth links, the user id. This
 * table owns everything the product wants to say about a person that auth has
 * no opinion about, which starts at a display name and a picture and grows from
 * there. Keeping them apart is what lets the auth component be upgraded, or
 * swapped, without a migration of product data.
 *
 * `deletedAt` is omitted from the public shape: it is never anything but
 * `undefined` here, because `me` refuses to return a tombstoned profile at all.
 * `avatarId` is omitted and `avatarUrl` added in its place -- the id is a handle
 * only this backend can do anything with, and a stored URL would be a signed,
 * expiring string sitting in a row going stale on its own schedule.
 */
const publicProfileValidator = v.object({
  ...schema.doc("profiles").omit("deletedAt", "avatarId").fields,
  avatarUrl: v.union(v.string(), v.null()),
});

export const me = publicQuery({
  args: {},
  returns: v.union(v.null(), publicProfileValidator),
  handler: async (ctx) => {
    const userId = ctx.userId;
    if (!userId) return null;

    const profile = await profileOf(ctx, userId);
    if (!profile) return null;

    // A deleted account has no profile, as far as the rest of the product is
    // concerned. Saying so HERE, once, is what keeps every other screen out of
    // it. The tombstone itself is readable through `account.deletionStatus`,
    // whose whole job is to be the one function that admits the row is there.
    if (profile.deletedAt !== undefined) return null;

    const { deletedAt: _deletedAt, avatarId, ...rest } = profile;
    // `getUrl` returns null for an id whose file is gone -- a purge, a failed
    // upload -- and every screen already draws initials when there is no
    // picture, so that is a state they handle rather than an error.
    return {
      ...rest,
      avatarUrl: avatarId ? await ctx.storage.getUrl(avatarId) : null,
    };
  },
});

/**
 * Create or rename this account's profile.
 *
 * An upsert rather than separate create/rename functions, because there is
 * exactly one moment a profile is needed -- somebody typing their name -- and
 * two functions would both have to handle "no row yet" anyway.
 */
export const saveProfile = authenticatedMutation({
  args: { displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, { displayName }): Promise<null> => {
    const userId = ctx.userId;

    const name = displayName.trim();
    if (!name) throwUserError("NAME_REQUIRED", "A name is required.");
    if (name.length > MAX_DISPLAY_NAME) {
      throwUserError(
        "NAME_REQUIRED",
        `A name can be at most ${MAX_DISPLAY_NAME} characters.`,
      );
    }

    const existing = await profileOf(ctx, userId);

    // A tombstoned account is silently refused rather than told off: the only
    // way to reach here is a race between two tabs, one of them deleting.
    if (existing?.deletedAt !== undefined) return null;

    const profile = existing ?? (await ensureProfile(ctx, userId));
    await ctx.db.patch(profile._id, { displayName: name });
    return null;
  },
});

/**
 * Step one of two for a new avatar: a URL the browser may POST the bytes to.
 *
 * The file never passes through a Convex function. That is not an optimisation
 * -- a mutation cannot receive a multi-megabyte argument, and an action that
 * relayed the bytes would double the transfer and put the upload inside our own
 * execution budget. The browser posts straight to storage, gets an id back, and
 * `setAvatar` below is what makes that id mean anything.
 *
 * Requires an account, so an anonymous caller cannot mint upload URLs and use
 * this deployment's storage as their own.
 */
export const generateAvatarUploadUrl = authenticatedMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step two: adopt an uploaded file as this account's picture.
 *
 * The metadata check is the real gate. `_storage` records the type and size the
 * upload actually had, so this refuses an SVG (an image by MIME, and a
 * script-execution surface) and a file over the ceiling AFTER the bytes landed
 * -- the browser-side check in `convex/lib/account/avatar.ts` is a courtesy that
 * saves a pointless upload, not a rule, because anything the browser enforces
 * the browser can also skip.
 *
 * ORDER MATTERS, and not for tidiness. A mutation is a transaction:
 * `throwUserError` rolls back everything the handler did, INCLUDING a
 * `ctx.storage.delete`, so deleting-then-throwing deletes nothing and only
 * reads as though it does. The no-profile path returns instead of throwing, so
 * its delete commits.
 */
export const setAvatar = authenticatedMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { storageId }): Promise<null> => {
    const userId = ctx.userId;

    const existing = await profileOf(ctx, userId);
    // A tombstone still discards the upload and returns: a throw would roll
    // the delete back and leave the blob behind.
    if (existing?.deletedAt !== undefined) {
      await ctx.storage.delete(storageId);
      return null;
    }
    const profile = existing ?? (await ensureProfile(ctx, userId));

    const uploaded = await ctx.db.system.get(storageId);
    if (!uploaded) {
      throwUserError(
        "AVATAR_MISSING",
        "That upload did not finish. Please try again.",
      );
    }
    if (!AVATAR_TYPES.includes(uploaded.contentType ?? "")) {
      throwUserError(
        "AVATAR_TYPE",
        "A picture has to be a PNG, JPEG, WebP or GIF.",
      );
    }
    if (uploaded.size > MAX_AVATAR_BYTES) {
      throwUserError(
        "AVATAR_SIZE",
        `A picture has to be under ${MAX_AVATAR_MB}MB.`,
      );
    }

    const previous = profile.avatarId;
    await ctx.db.patch(profile._id, { avatarId: storageId });
    // Deleted only after the row points somewhere else, so a failure between
    // the two leaves an orphan file rather than a roundel pointing at nothing.
    if (previous) await ctx.storage.delete(previous);
    return null;
  },
});

/** Back to initials, and the bytes go with it. */
export const clearAvatar = authenticatedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const userId = ctx.userId;

    const profile = await profileOf(ctx, userId);
    if (!profile?.avatarId) return null;

    const previous = profile.avatarId;
    await ctx.db.patch(profile._id, { avatarId: undefined });
    await ctx.storage.delete(previous);
    return null;
  },
});

/** Remember which workspace the app opens. Requires a seat in it. */
export const setActiveOrg = orgMutation()({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await setActiveOrgOf(ctx, ctx.userId, ctx.orgId);
    return null;
  },
});
