import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// P9: Pivot Map drafts expire 30 days after they were made. 16:00 UTC is 3 AM AEDT.
crons.cron(
  "expire map drafts",
  "0 16 * * *",
  internal.careers.drafts.expire,
  {},
);

export default crons;
