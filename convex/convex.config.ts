import { defineApp } from "convex/server";
import betterAuth from "@convex-dev/better-auth/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp();
app.use(betterAuth);
app.use(rateLimiter);
// Email that must survive a failed request: the component queues and retries,
// so an invitation can be sent from inside the mutation that mints it.
app.use(resend);

export default app;
