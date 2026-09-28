import { Workpool } from "@convex-dev/workpool";
import { components, internal } from "../../_generated/api";
import type { MutationCtx } from "../../_generated/server";

/**
 * The queue every outbound notification goes through.
 *
 * WHY A POOL AND NOT `ctx.scheduler.runAfter(0, ...)`. Both defer the work off
 * the mutation, which is the part that matters -- nothing on a screen may wait
 * for a push service to answer. Only the pool bounds how much of it runs at
 * once. One room event fans out to a request per device, and the events arrive
 * in bursts by their nature: a match notifies everybody, and a room that just
 * matched is about to have a plan written and a booking made. Unbounded, that
 * is a burst of parallel actions each holding several open sockets.
 *
 * `maxParallelism: 8` is a starting number, not a measured one. Raise it when
 * a queue actually backs up, and give any second kind of background work its
 * own pool in `convex/convex.config.ts` rather than sharing this one.
 *
 * RETRIES ARE OFF, deliberately. Retrying is
 * decided per endpoint inside `pushSend`, where the endpoint is actually known:
 * a 404 or 410 deletes the subscription, and anything else is logged and left
 * alone. A pool-level retry would re-run the whole fan-out because one device
 * out of four was briefly unreachable, re-sending to the three that already
 * received it.
 */
const pushDelivery = new Workpool(components.pushDelivery, {
  maxParallelism: 8,
  retryActionsByDefault: false,
});

/**
 * Tell one owner's devices something.
 *
 * `owner` is a key the SERVER resolved -- see `lib/push/notify.ts`. Nothing
 * that reaches here may come from a client argument, or this is an endpoint for
 * pushing arbitrary text at arbitrary people.
 */
export function enqueuePush(
  ctx: MutationCtx,
  owner: string,
  notification: { title: string; body: string; url: string },
) {
  return pushDelivery.enqueueAction(
    ctx,
    internal.pushSend.deliver,
    { owner, ...notification },
    { retry: false },
  );
}

/** The settings screen's "send a test", to one owner's own devices. */
export function enqueueTestPush(ctx: MutationCtx, owner: string) {
  return pushDelivery.enqueueAction(
    ctx,
    internal.pushSend.deliverTest,
    { owner },
    { retry: false },
  );
}
