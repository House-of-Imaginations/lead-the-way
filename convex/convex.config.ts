import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import migrations from "@convex-dev/migrations/convex.config.js";
import presence from "@convex-dev/presence/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";

const app = defineApp();
app.use(betterAuth);
// Schema change, made possible at all. Without a backfill tool, stamping a
// field onto rows that predate it is work nobody wants to hand-roll, so every
// new column becomes `v.optional(...)` forever. `convex/migrations.ts` holds the
// definitions; this is what lets them track their own progress and resume.
app.use(migrations);
// Who is actually connected right now, as a heartbeat rather than a stored
// flag -- somebody who closed the tab and somebody who is idle look identical
// to anything else. Display-only; see `convex/presence.ts`.
app.use(presence);
app.use(rateLimiter);
// Email that must survive a failed request rather than vanishing with it: the
// component queues, batches and retries through its own workpool, which is why
// an invitation can be sent from inside the mutation that mints it.
app.use(resend);
// Outbound work that must not run inline: a push fan-out is N HTTPS requests
// with their own failures and retries, and a mutation cannot wait on those.
// A named pool per kind of work, never one shared pool -- two workloads with
// nothing in common sharing one parallelism budget means a burst of either
// starves the other.
app.use(workpool, { name: "pushDelivery" });

export default app;
