import { defineSchema } from "convex/server";
import { orgTables } from "./tables/orgs";
import { profileTables } from "./tables/profiles";

export default defineSchema({
  ...orgTables,
  ...profileTables,
});
