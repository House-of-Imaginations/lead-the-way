import { internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf, type CastKey } from "../../convex/lib/demo/cast";
import { PATHWAY_MODULES } from "../../convex/lib/pathway";
import { mel, type DemoTarget } from "../../convex/lib/demo/schedule";
import type { T } from "./workspace/helpers";

/** Shared by the sprint 2 tests: no tests in here. */

export const move = (t: T, target: DemoTarget) =>
  t.mutation(internal.seed.clock, { target });

/** The demo clock at an instant. Melbourne is +11:00 from 4 October, so dates after that skip `mel`. */
export const clockAt = (t: T, orgId: Id<"orgs">, at: number) =>
  t.run((ctx) => ctx.db.patch(orgId, { demoNow: at }));

export async function personOf(t: T, orgId: Id<"orgs">, key: CastKey) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

/** The workspace's sprints, oldest first. */
export async function sprintsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

/** The clone, launched as `launch` leaves it: its pinned week one kept, `launchedAt` set. */
export async function launchClone(t: T, orgId: Id<"orgs">) {
  const clone = (await sprintsOf(t, orgId))[1]!;
  await t.run((ctx) =>
    ctx.db.patch(clone._id, { launchedAt: mel("2026-10-01T17:00") }),
  );
  return clone._id;
}

/** What `launch` needs besides the hour: everyone's pathway and a saved agreement. */
export async function readyToLaunch(t: T, orgId: Id<"orgs">) {
  await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const person of people) {
      for (const m of PATHWAY_MODULES) {
        if (m.pathway !== "required") continue;
        await ctx.db.insert("pathwayProgress", {
          orgId,
          personId: person._id,
          moduleKey: m.key,
          minutesWatched: m.minutes,
          completedAt: 1,
        });
      }
    }
    await ctx.db.insert("agreements", {
      orgId,
      teamId: team._id,
      version: 1,
      status: "saved",
      tools: [],
      neverIn: [],
      checks: [],
      escalation: "",
      contact: { kind: "label", label: "Privacy officer" },
      savedAt: 1,
    });
  });
}
