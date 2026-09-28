import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { authenticatedMutation, publicQuery } from "./lib/customFunctions";
import { profileOf } from "./lib/account/profile";
import { ensureProfile } from "./lib/account/ensureProfile";
import { PURGE_WINDOW_MS, purgeAt } from "./lib/account/window";
import { throwUserError } from "./lib/errors";
import { dropOwner } from "./lib/push/notify";
import { NOTIFICATION_EVENTS } from "./lib/push/preferences";
import { releaseSeats } from "./lib/orgs/cascade";

/**
 * Deleting an account, and the fourteen days in which it can be undeleted.
 *
 * The shape, and why it is this shape rather than one `ctx.db.delete`:
 *
 *  - The tombstone (`profiles.deletedAt`) is set immediately and
 *    `profiles.me` starts returning null, so the product behaves as though the
 *    account is gone from the first render after the tap.
 *  - The push subscriptions go immediately and for good, because somebody who
 *    has deleted their account must stop hearing from it at the tap.
 *  - The row itself survives the window, because a restore with nothing to
 *    restore is not a restore. `purgeExpired` erases it once the window closes.
 *
 * The cost of that last point is stated plainly on the screen rather than
 * buried here: for the length of the window the profile still exists. A delete
 * that erased everything at the tap and a delete that can be undone are
 * different products, and this is the second.
 *
 * ANYTHING THIS PRODUCT ADDS THAT IS NOT THIS PERSON'S DATA ALONE -- a seat in
 * a shared room, an item somebody else depends on -- is released HERE, at the
 * tap, not at the purge. Shared state that waits on a departed account is a
 * deadlock with a fourteen-day fuse.
 */

/** How the product asks whether this account is on its way out. */
const deletionStatusValidator = v.union(
  v.null(),
  v.object({ deletedAt: v.number(), purgeAt: v.number() }),
);

/**
 * The one function that admits a tombstoned profile is still there.
 *
 * Separate from `profiles.me` on purpose: `me` returns null for a deleted
 * account so no other screen has to know this state exists, which means `me`
 * cannot also be the thing that reports it. A signed-out caller and a caller
 * with no tombstone both get null -- neither is on their way out, and the
 * difference between them is not this query's business.
 */
export const deletionStatus = publicQuery({
  args: {},
  returns: deletionStatusValidator,
  handler: async (ctx) => {
    const userId = ctx.userId;
    if (!userId) return null;

    const profile = await profileOf(ctx, userId);
    if (!profile || profile.deletedAt === undefined) return null;

    return {
      deletedAt: profile.deletedAt,
      purgeAt: purgeAt(profile.deletedAt),
    };
  },
});

export const deleteAccount = authenticatedMutation({
  args: {},
  returns: deletionStatusValidator.members[1],
  handler: async (ctx) => {
    const userId = ctx.userId;

    const existing = await profileOf(ctx, userId);
    if (existing?.deletedAt !== undefined) {
      throwUserError(
        "ACCOUNT_ALREADY_DELETED",
        "This account is already scheduled for deletion.",
      );
    }
    // An account with no profile row still gets a tombstone, so the purge and
    // the restore window apply to it like any other.
    const profile = existing ?? (await ensureProfile(ctx, userId));

    // Notifications stop at the tap, and do NOT come back with a restore.
    await dropOwner(ctx, userId);

    // Workspace seats are shared state, so they go at the tap. This THROWS if
    // they are the only owner of a workspace somebody else is still in, which
    // rolls back the tombstone too.
    await releaseSeats(ctx, userId);

    const deletedAt = Date.now();
    await ctx.db.patch(profile._id, { deletedAt });
    return { deletedAt, purgeAt: purgeAt(deletedAt) };
  },
});

/**
 * Change your mind, inside the window.
 *
 * Clearing the tombstone is the whole of it. The taste vector, the sentence,
 * and the answers were never touched, so the account comes back as it was
 * -- minus the seats and the push subscriptions, which are gone for good and
 * which the delete screen said would be.
 */
export const restoreAccount = authenticatedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const userId = ctx.userId;

    const profile = await profileOf(ctx, userId);
    if (!profile || profile.deletedAt === undefined) {
      throwUserError(
        "NOT_DELETED",
        "This account is not scheduled for deletion.",
      );
    }
    if (profile.purgeStartedAt !== undefined) {
      throwUserError(
        "ACCOUNT_PURGE_STARTED",
        "This account's deletion has already started and can't be undone.",
      );
    }

    // Deliberately NOT refused once the window has passed. A row that is still
    // here after `PURGE_WINDOW_DAYS` is a row the purge has not reached yet --
    // the job runs daily, so there is a gap of up to a day where the deadline
    // has passed and the data is still present. Refusing in that gap would tell
    // somebody their account was gone while it was sitting right there, and
    // then the next cron tick would make the lie true. If they came back, they
    // came back.
    await ctx.db.patch(profile._id, { deletedAt: undefined });
    return null;
  },
});

/**
 * Erase what the window was protecting. Runs daily, from `convex/crons.ts`.
 *
 * THE TRAP, and the reason this query is not the obvious one-sided range:
 * a document with no `deletedAt` is still in the `by_deletedAt` index, and an
 * absent value sorts BEFORE every number. So `q.lt("deletedAt", cutoff)` on its
 * own matches every live profile in the table, and the job that was meant to
 * tidy up after deletions would delete the accounts of everyone who never
 * asked. The range is bounded at both ends for that reason alone -- `gt(0)` is
 * not a plausible-timestamp check, it is the floor that excludes "absent".
 *
 * Bounded per run rather than collected: this is the one function in the
 * product with no user waiting on it, so there is no reason for it to be able
 * to grow into a transaction that cannot commit. A backlog is drained by
 * tomorrow's run.
 *
 * THE PROFILE ROW IS NOT THE WHOLE OF THE ACCOUNT, and deleting only it is how
 * a "deleted" account goes on existing. Everything this person owns alone goes
 * here: their notes and the avatar sitting in file storage. Anything SHARED
 * went at the tap, in `deleteAccount` above, for the reason stated there.
 *
 * A stored file is the easiest of the three to leave behind, because nothing
 * ever reads it again to notice. It is not in a table, so no query returns it,
 * no test that counts rows catches it, and the bill is the only thing that
 * knows.
 *
 * Returns how many accounts it finished, so the deployment's logs say whether
 * it is keeping up rather than only that it ran.
 */
const MAX_PURGE_PER_RUN = 100;

/**
 * The ceiling on one run's deletes, shared across every account it touches.
 *
 * Per-account would be the wrong unit: a hundred accounts each under their own
 * limit is still a transaction a hundred times too big. This is one budget for
 * the whole run, and an account whose notes exhaust it keeps its tombstone and
 * is finished by the continuation below.
 */
const MAX_DELETES_PER_RUN = 500;

export const purgeExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const cutoff = Date.now() - PURGE_WINDOW_MS;

    const expired = await ctx.db
      .query("profiles")
      .withIndex("by_deletedAt", (q) =>
        q.gt("deletedAt", 0).lt("deletedAt", cutoff),
      )
      .take(MAX_PURGE_PER_RUN);

    let budget = MAX_DELETES_PER_RUN;
    let purged = 0;

    for (const profile of expired) {
      if (budget <= 0) break;

      // Stamped before anything goes: from here a restore would bring back an
      // account with pieces missing, so `restoreAccount` refuses once it is set.
      if (profile.purgeStartedAt === undefined) {
        await ctx.db.patch(profile._id, { purgeStartedAt: Date.now() });
      }

      // One more than may be deleted, so "there are more left" is a fact about
      // this read rather than a second query to ask it.
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_user", (q) => q.eq("userId", profile.userId))
        .take(budget + 1);

      const deletable = notes.slice(0, budget);
      for (const note of deletable) {
        await ctx.db.delete(note._id);
      }
      budget -= deletable.length;

      // Out of budget part-way through this account. Its tombstone stays, which
      // is what makes the job resumable: the row IS the record of unfinished
      // work, so the continuation finds it again by the same index read.
      if (notes.length > deletable.length) break;

      // At most one row per event, so it needs no budget of its own.
      const preferences = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_owner_and_event", (q) => q.eq("owner", profile.userId))
        .take(NOTIFICATION_EVENTS.length);
      for (const row of preferences) await ctx.db.delete(row._id);

      // Before the row, not after: the id lives on the row, and a throw between
      // the two would roll the whole mutation back anyway.
      if (profile.avatarId) await ctx.storage.delete(profile.avatarId);
      await ctx.db.delete(profile._id);
      purged += 1;
      budget -= 1;
    }

    // Spent the budget, so there is more to do and a day is too long to wait --
    // for the fourteen days the window promised, "deleted" has to become true
    // in minutes rather than over the weeks a daily cron would take to grind
    // through a large account. It terminates because a run that reaches here
    // deleted something, and a run with nothing left to delete does not.
    if (budget <= 0) {
      await ctx.scheduler.runAfter(0, internal.account.purgeExpired, {});
    }

    return purged;
  },
});
