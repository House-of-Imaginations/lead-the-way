import { defineSchema } from "convex/server";
import { noteTables } from "./tables/notes";
import { orgTables } from "./tables/orgs";
import { profileTables } from "./tables/profiles";
import { pushTables } from "./tables/push";
import { inboxTables } from "./tables/inbox";

export default defineSchema({
  ...noteTables,
  ...orgTables,
  ...profileTables,
  ...pushTables,
  ...inboxTables,
});
