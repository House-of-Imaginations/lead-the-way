import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { publicQuery } from "./lib/customFunctions";
import { authenticatedMutation } from "./lib/customFunctions";
import { devicesOf, MAX_DEVICES_PER_OWNER } from "./lib/push/notify";
import {
  NOTIFICATION_EVENTS,
  notificationEventValidator,
  type NotificationEvent,
} from "./lib/push/preferences";
import { enqueueTestPush } from "./lib/push/queue";
import { reserveRateLimit } from "./lib/rateLimits";

/**
 * Web push: the subscriptions, and who a notification is allowed to reach.
 *
 * The sending itself is NOT here. `web-push` is a Node-only package, and the
 * generated guidelines forbid `"use node"` in a file that also exports queries
 * or mutations, so the action lives alone in `convex/pushSend.ts`. This file is
 * the V8 half: the mutations a browser calls, the key it needs to subscribe,
 * and the internal reads the action runs against the database it cannot touch
 * itself.
 *
 * WHO A SUBSCRIPTION BELONGS TO. The signed-in account, resolved by the server
 * from `ctx.userId`, and never from an argument. A caller can never name
 * somebody else -- there is no user id or endpoint-owner argument anywhere in
 * this file that a client chooses.
 */

/**
 * What the delivery action is told about one recipient.
 *
 * Projected rather than handed the whole document, the way `myRoomValidator`
 * does in `profiles.ts`: the action has no business knowing whose row this is,
 * only where to send and how to encrypt. `owner` is deliberately absent.
 */
const deliveryTargetValidator = v.object({
  endpoint: v.string(),
  p256dh: v.string(),
  auth: v.string(),
});

/** The whole of what `pushSend.deliver` needs to do its job. */
const deliveryValidator = v.union(
  v.null(),
  v.object({
    title: v.string(),
    body: v.string(),
    url: v.string(),
    targets: v.array(deliveryTargetValidator),
  }),
);

/**
 * The public half of the VAPID pair, or null when push is not configured.
 *
 * Served from the deployment env rather than baked into the bundle as a
 * `NEXT_PUBLIC_` variable, so both halves of one keypair live in one place and
 * are rotated together with `npx convex env set`. The private half never leaves
 * the deployment; this one is designed to be public -- it is the application
 * server key the browser hands to its push service.
 *
 * Null is the honest answer on a deployment with no keys set, and every screen
 * treats it as "push does not exist here" rather than as a failure. That is
 * what makes this feature safe to merge before the keys are issued.
 *
 * Read inside the handler, never at module scope: a module-scope read is
 * evaluated once when the isolate starts, which would make the answer depend on
 * whether the environment was configured before or after that moment.
 */
export const publicKey = publicQuery({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (): Promise<string | null> => {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  },
});

/**
 * Remember this browser.
 *
 * UPSERT ON ENDPOINT, NOT INSERT. A browser hands back the same endpoint every
 * time it subscribes -- after a service worker update, after the permission is
 * toggled off and on, after a reinstall -- so an insert would give that one
 * phone two rows and every notification twice. Patching also re-homes an
 * endpoint whose owner changed, which is what happens when a guest signs in, or
 * when one person signs out of a shared device and another signs in: the row
 * follows the endpoint, because the endpoint is the browser and the browser is
 * what will receive it.
 */
export const subscribe = authenticatedMutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const owner = ctx.userId;

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      // The keys are re-sent because a re-subscription can rotate them; the
      // browser generates a fresh pair whenever it makes a genuinely new
      // subscription, and encrypting to a stale key produces a payload that
      // phone can never open.
      await ctx.db.patch(existing._id, {
        owner,
        p256dh: args.p256dh,
        auth: args.auth,
      });
      return true;
    }

    const mine = await devicesOf(ctx, owner);

    // At the ceiling, the oldest row goes rather than the new one being
    // refused. Somebody standing in front of a phone that just asked for
    // permission has said yes to THIS device, and telling them no because of
    // devices they may not own any more would be the wrong half to drop.
    if (mine.length >= MAX_DEVICES_PER_OWNER) {
      const oldest = [...mine].sort((a, b) => a.createdAt - b.createdAt)[0];
      await ctx.db.delete(oldest._id);
    }

    await ctx.db.insert("pushSubscriptions", {
      owner,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: Date.now(),
    });
    return true;
  },
});

/**
 * Forget this browser.
 *
 * Keyed on the endpoint and checked against the caller's own owner key, so
 * unsubscribing is turning off YOUR device and never somebody else's: an
 * endpoint is a string a client supplies, and without the ownership check
 * anybody holding one could silence the person it belongs to.
 *
 * Silent when the row is already gone or is not the caller's. The browser's own
 * `unsubscribe()` and this call are two independent operations and either can
 * land first, so "there was nothing to delete" is the ordinary outcome of a
 * retry, not a failure worth a sentence.
 */
export const unsubscribe = authenticatedMutation({
  args: { endpoint: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const owner = ctx.userId;
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing && existing.owner === owner) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/**
 * Does this caller have any device listening? What the settings toggle draws.
 *
 * A count and not the rows: a subscription's endpoint and keys are the material
 * a payload is encrypted with, and no screen needs them. Sending them to the
 * browser would be handing out the one thing that has to stay server-side for
 * "sending must be server-side" to mean anything.
 *
 * NULL AND ZERO ARE DIFFERENT ANSWERS, and the difference is the reason this
 * returns a union rather than a number. Zero is "we know who you are and you
 * have no devices" -- draw the toggle, off. Null is "there is nobody here to
 * file a subscription under": signed out, holding no seat. A screen that
 * collapsed the two would offer a control that cannot work, and the client has
 * no other way to ask -- identity is resolved on the server and only there.
 */
export const myDeviceCount = publicQuery({
  args: {},
  returns: v.union(v.null(), v.number()),
  handler: async (ctx): Promise<number | null> => {
    const owner = ctx.userId;
    if (!owner) return null;
    const mine = await devicesOf(ctx, owner);
    return mine.length;
  },
});

/**
 * Prove it works, on your own devices only.
 *
 * The recipient is whoever the SERVER resolved the caller to be, and there is
 * no argument that could name anybody else. That is the whole security design
 * of this endpoint: a "send a notification" mutation that accepted a target
 * would be a way to push arbitrary text to arbitrary people, which is exactly
 * what the ticket's second constraint forbids.
 *
 * Rate limited because it is a public endpoint whose whole job is to cause
 * outbound network traffic, and keyed on the resolved owner so a guest's taps
 * are counted against their seat rather than against everybody else's.
 * `reserveRateLimit` is called straight from the lib here rather than through a
 * wrapper in `convex/rateLimits.ts`: those wrappers exist so ACTIONS can reach
 * a mutation-only limiter through `runMutation`, and this is already a
 * mutation.
 */
export const sendTest = authenticatedMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx): Promise<boolean> => {
    const owner = ctx.userId;
    await reserveRateLimit(ctx, "pushTest", owner);
    await enqueueTestPush(ctx, owner);
    return true;
  },
});

/**
 * Where one owner's notifications go.
 *
 * The recipient list is read HERE, on the server, from the owner key the
 * enqueueing mutation resolved. Nothing in the chain from the call site to the
 * push service accepts an endpoint from a browser.
 */
export const targets = internalQuery({
  args: { owner: v.string() },
  returns: v.array(deliveryTargetValidator),
  handler: async (ctx, args) => {
    const rows = await devicesOf(ctx, args.owner);
    return rows.map((row) => ({
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    }));
  },
});

/** The same shape for the test send, whose recipient is one owner's devices. */
export const testDelivery = internalQuery({
  args: { owner: v.string() },
  returns: deliveryValidator,
  handler: async (ctx, args) => {
    const rows = await devicesOf(ctx, args.owner);
    if (rows.length === 0) return null;

    return {
      title: "Lead the Way",
      body: "Notifications are on. This is what one looks like.",
      // The notifications settings page, because that is where the button was
      // tapped and where the control to turn it off again is.
      url: "/settings/notifications",
      targets: rows.map((row) => ({
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      })),
    };
  },
});

/**
 * Delete endpoints the push service says are gone.
 *
 * A 404 or a 410 from a push service is authoritative and permanent: that
 * browser will never receive anything again, because the subscription was
 * revoked, the site data was cleared, or the endpoint expired. Nothing else is
 * treated this way -- a 429, a 500 or a timeout is the push service having a
 * bad minute, and deleting a live subscription over one would silently
 * unsubscribe somebody who did nothing.
 *
 * This is the "cleaned up when the browser reports them expired" half of the
 * ticket's second acceptance criterion.
 */
export const dropExpired = internalMutation({
  args: { endpoints: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    for (const endpoint of args.endpoints) {
      const row = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
        .unique();
      if (row) await ctx.db.delete(row._id);
    }
    return null;
  },
});

/**
 * The caller's choice for every event, missing rows filled in as on.
 * Null for a signed-out caller, the same way `myDeviceCount` is, so a screen
 * mid-sign-out draws nothing instead of throwing.
 */
export const myPreferences = publicQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.array(
      v.object({ event: notificationEventValidator, enabled: v.boolean() }),
    ),
  ),
  handler: async (ctx) => {
    const owner = ctx.userId;
    if (!owner) return null;
    const rows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_owner_and_event", (q) => q.eq("owner", owner))
      .take(NOTIFICATION_EVENTS.length);
    const stored = new Map<NotificationEvent, boolean>(
      rows.map((row) => [row.event, row.enabled]),
    );
    return NOTIFICATION_EVENTS.map((event) => ({
      event,
      enabled: stored.get(event) ?? true,
    }));
  },
});

/** Turn one event on or off for the caller's account. */
export const setPreference = authenticatedMutation({
  args: { event: notificationEventValidator, enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { event, enabled }): Promise<null> => {
    const owner = ctx.userId;
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_owner_and_event", (q) =>
        q.eq("owner", owner).eq("event", event),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled });
    } else {
      await ctx.db.insert("notificationPreferences", { owner, event, enabled });
    }
    return null;
  },
});
