import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  authenticatedAction,
  authenticatedMutation,
  authenticatedQuery,
} from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { jsonCompletion } from "./lib/openai";

/**
 * One of each: a query, a mutation, and an action. The example every new
 * feature in this backend is copied from, and the shortest statement of the
 * house rules.
 *
 *  - Identity comes from the wrapper (`ctx.userId`), never from an argument.
 *    `convex/lib/customFunctions.ts` says why, and `lib/auth/identity.ts` is
 *    the only place it is derived.
 *  - Every function declares `args` AND `returns`. The return validator is not
 *    documentation: it is what stops a private column reaching the browser the
 *    day somebody adds one to the table.
 *  - Every read goes through an index. No `.filter()`, and no `.collect()` on
 *    anything that grows -- `.take(n)` with a stated ceiling instead.
 *  - An action cannot touch the database. It calls the network, then hands the
 *    result to an internal mutation to write.
 */

/** A ceiling, so this read cannot grow into a scan as the table fills. */
const MAX_NOTES = 100;

const noteValidator = v.object({
  _id: v.id("notes"),
  _creationTime: v.number(),
  text: v.string(),
  createdAt: v.number(),
});

/**
 * QUERY. Reactive: every client subscribed to this re-renders when a mutation
 * changes a row it read. `userId` is projected away -- the caller already knows
 * who they are, and a field nothing needs is a field that can leak.
 */
export const list = authenticatedQuery({
  args: {},
  returns: v.array(noteValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .take(MAX_NOTES);

    return rows.map(({ _id, _creationTime, text, createdAt }) => ({
      _id,
      _creationTime,
      text,
      createdAt,
    }));
  },
});

/**
 * MUTATION. A transaction: it either commits whole or not at all, so a throw
 * anywhere in here undoes every write above it -- including a `ctx.storage`
 * delete. Validate first, write second.
 */
export const add = authenticatedMutation({
  args: { text: v.string() },
  returns: v.id("notes"),
  handler: async (ctx, { text }) => {
    const trimmed = text.trim();
    if (!trimmed) throwUserError("FIELD_REQUIRED", "A note needs some text.");

    return await ctx.db.insert("notes", {
      userId: ctx.userId,
      text: trimmed,
      createdAt: Date.now(),
    });
  },
});

/**
 * The write half of the action below.
 *
 * `internalMutation`, so it is unreachable from a browser: `userId` is an
 * argument here, and an argument is something a client chooses. It is safe only
 * because the one caller derived it from the authenticated identity first.
 * Every "internal function takes a user id" in this codebase carries that same
 * obligation.
 */
export const writeSummary = internalMutation({
  args: { userId: v.string(), text: v.string() },
  returns: v.id("notes"),
  handler: async (ctx, { userId, text }) => {
    return await ctx.db.insert("notes", {
      userId,
      text,
      createdAt: Date.now(),
    });
  },
});

/**
 * ACTION. The only kind of function that may reach the network, and the only
 * one that is NOT a transaction -- it can run twice, and it can fail after a
 * side effect. Keep the non-transactional part small: call out, then write
 * through one internal mutation.
 *
 * No database access from here. `ctx.runQuery` and `ctx.runMutation` are the
 * doors, and each one is its own transaction.
 */
export const summarize = authenticatedAction({
  args: { prompt: v.string() },
  returns: v.string(),
  handler: async (ctx, { prompt }): Promise<string> => {
    // Reserved BEFORE the call, against the provider's own quota rather than
    // against this user -- see `convex/lib/rateLimits.ts` for why the two are
    // separate limits.
    const reserve = () =>
      ctx.runMutation(internal.rateLimits.reserveProvider, {
        provider: "openai",
      });

    let summary: string;
    try {
      const result = await jsonCompletion(
        `Reply with JSON {"summary": string}. Summarise in one sentence: ${prompt}`,
        reserve,
      );
      // A model's output is untrusted input. Narrow every field that is read.
      const parsed = result as { summary?: unknown };
      summary = typeof parsed.summary === "string" ? parsed.summary : "";
    } catch {
      // The provider is allowed to be down. What is not allowed is a screen
      // left waiting on it, so the failure becomes a value the caller can show.
      summary = "";
    }

    if (!summary) return "";

    await ctx.runMutation(internal.notes.writeSummary, {
      userId: ctx.userId,
      text: summary,
    });
    return summary;
  },
});
