import { defineSchema } from "convex/server";
import { careerTables } from "./tables/careers";
import { demoTables } from "./tables/demo";
import { orgTables } from "./tables/orgs";
import { profileTables } from "./tables/profiles";
import { sprintTables } from "./tables/sprint";

export default defineSchema({
  ...orgTables,
  ...profileTables,
  ...sprintTables,
  ...demoTables,
  ...careerTables,
});
