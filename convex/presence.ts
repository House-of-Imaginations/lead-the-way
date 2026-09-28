import { v } from "convex/values";
import { Presence } from "@convex-dev/presence";
import { components } from "./_generated/api";
import { mutation } from "./_generated/server";
import { assertFlag } from "./app";
import { authenticatedMutation, publicQuery } from "./lib/customFunctions";

/**
 * Who has a given room open right now.
 *
 * "Room" here is any shared surface -- a document, a board, a game -- named by
 * a string the caller already has the right to be looking at. Presence is
 * keyed on it and on the viewer.
 *
 * THIS IS DISPLAY-ONLY, AND THAT IS THE WHOLE DESIGN. Never let a heartbeat
 * feed a rule: a decision that turns on whether somebody's phone was awake is a
 * decision that changes when a tab sleeps. Anything that must be true about a
 * group is computed from stored membership, not from who is currently lit up.
 */
export const presence = new Presence(components.presence);

/**
 * How long a client may go quiet before it is presumed gone.
 *
 * Server-side, not a client argument. The component disconnects at 2.5x this,
 * so a client that could name its own interval could keep its own face lit
 * indefinitely -- and this is a signal about somebody's attention, which makes
 * it exactly the wrong thing to let that somebody assert about themselves.
 */
const HEARTBEAT_MS = 10_000;

export const heartbeat = authenticatedMutation({
  args: {
    roomId: v.string(),
    // Per TAB, not per browser. A session id that was shared between tabs would
    // let closing one tab mark the other one away.
    sessionId: v.string(),
  },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, { roomId, sessionId }) => {
    assertFlag("presence", true);
    // Authorise the caller against `roomId` HERE before lighting them up. As
    // written, any signed-in account may appear in any room -- which is fine
    // while rooms are not yet a thing in this app, and is the first thing to
    // fix when they are.
    return await presence.heartbeat(
      ctx,
      roomId,
      ctx.userId,
      sessionId,
      HEARTBEAT_MS,
    );
  },
});

/**
 * The room token already proves the caller heartbeat into this room, and the
 * component's own guidance is to add no per-user reads here so every subscriber
 * in the room shares one cached result.
 *
 * The trade that buys the shared cache: the component mints one token per room
 * and never rotates it, so this does not re-check membership on each read, and
 * somebody whose access was revoked can keep subscribing with the token they
 * already hold. What they see is ids and booleans -- no names, no contents --
 * which is why this is the side of the trade worth taking. Do not add names or
 * payloads to it.
 */
export const list = publicQuery({
  args: { roomToken: v.string() },
  returns: v.array(
    v.object({
      userId: v.string(),
      online: v.boolean(),
      lastDisconnected: v.number(),
      data: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, { roomToken }) => {
    assertFlag("presence", true);
    return await presence.list(ctx, roomToken);
  },
});

/**
 * Plain `mutation`, not `publicMutation`: the session token IS the
 * authorisation here. It was minted by that session's own heartbeat and grants
 * nothing but marking that one session away, so there is no identity left for
 * the wrapper to establish.
 *
 * Best effort, and the timeout is the real backstop. The client fires this from
 * `pagehide`, and a tab being closed is not obliged to finish sending it. When
 * it does land the face greys out immediately; when it does not, the missed
 * heartbeats do it 25 seconds later.
 */
export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    assertFlag("closed", false);
    // Deliberately NOT gated on `presence`. This only ever deletes, and its
    // token can exist only because a heartbeat minted it while the flag was
    // on -- refusing it after the flag flips would strand a lit-up face for
    // the full timeout instead of greying it out now.
    await presence.disconnect(ctx, sessionToken);
    return null;
  },
});
