import { beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { nowFor } from "../../convex/lib/clock";
import { DEMO_TARGETS, SCHEDULE, mel } from "../../convex/lib/demo/schedule";
import { ORG_TABLES } from "../../convex/lib/orgs/cascade";
import { aggregate } from "../../convex/lib/privacy";
import { seedDemoAccounts } from "./testHelpers";
import { harness, workspace, type T } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});

async function calderLane() {
  const t = harness();
  const accounts = await seedDemoAccounts(t);
  const orgId = await t.mutation(internal.seed.writeCalderLane, { accounts });
  const as = (key: string) => t.withIdentity({ subject: accounts[key] });
  return { t, orgId, as };
}

async function personId(t: T, orgId: Id<"orgs">, email: string) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === email)!._id;
  });
}

async function projectOf(t: T, orgId: Id<"orgs">, person: Id<"people">) {
  return await t.run(async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return projects.find((p) => p.personId === person)!;
  });
}

async function sprintOf(t: T, orgId: Id<"orgs">) {
  return (await t.run((ctx) =>
    ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
  ))!;
}

/** What the screens will show, read straight from the tables. */
async function snapshot(t: T, orgId: Id<"orgs">) {
  const tables = await read(t, orgId);
  return { ...tables, percent: Object.fromEntries(tables.percent) };
}

async function read(t: T, orgId: Id<"orgs">) {
  return await t.run(async (ctx) => {
    const org = (await ctx.db.get(orgId))!;
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const nameOf = new Map(people.map((p) => [p._id, p.name]));
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_org_and_status", (q) => q.eq("orgId", orgId))
      .collect();
    const progress = await ctx.db
      .query("learningProgress")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const signatures = await ctx.db
      .query("agreementSignatures")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const sprint = (await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    const outcome = async (
      phase: "before" | "after",
      question: "aiConfidence" | "comfortWithManager",
    ) => {
      const rows = await ctx.db
        .query("surveyResponses")
        .withIndex("by_sprint_phase_and_question", (q) =>
          q
            .eq("sprintId", sprint._id)
            .eq("phase", phase)
            .eq("question", question),
        )
        .collect();
      const result = aggregate(
        rows.map((r) => r.score),
        org,
      );
      return result.hidden ? null : result.value;
    };
    return {
      people: people.map((p) => p.name).sort(),
      invites: invites.length,
      pending: invites.filter((i) => i.status === "pending").map((i) => i.name),
      finishedWeek1: progress.filter((p) => p.sessionsDone >= 1).length,
      // Pairs, not an object: a Convex value can't have "Tomás" as a key.
      percent: progress.map(
        (p) => [nameOf.get(p.personId)!, p.percent] as [string, number],
      ),
      drafts: projects.filter((p) => p.status === "draft").length,
      saved: projects.filter((p) => p.status === "saved").length,
      presented: projects
        .filter((p) => p.presentedAt !== undefined)
        .sort((a, b) => a.presentedAt! - b.presentedAt!)
        .map((p) => nameOf.get(p.personId)),
      signatures: signatures.length,
      outcomes: {
        before: [
          await outcome("before", "aiConfidence"),
          await outcome("before", "comfortWithManager"),
        ],
        after: [
          await outcome("after", "aiConfidence"),
          await outcome("after", "comfortWithManager"),
        ],
      },
    };
  });
}

test("each step runs once, in order, when the clock passes it", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");

  const dueByWeek2 = Object.entries(SCHEDULE)
    .filter(([, at]) => at <= DEMO_TARGETS.week2)
    .map(([key]) => key);
  expect(
    (await priya.mutation(api.demo.setClock, { target: "week2" })).applied,
  ).toEqual(dueByWeek2);

  const week2 = await snapshot(t, orgId);
  expect(week2.people).toHaveLength(8);
  expect(week2.invites).toBe(8);
  expect(week2.pending).toEqual(["Omar Haddad"]);
  expect(week2.finishedWeek1).toBe(6);
  expect(week2.drafts).toBe(5);
  expect(week2.percent["Dan Okafor"]).toBe(60);

  // The same target again applies nothing and changes nothing.
  expect(
    (await priya.mutation(api.demo.setClock, { target: "week2" })).applied,
  ).toEqual([]);
  expect(await snapshot(t, orgId)).toEqual(week2);

  // The rest, each exactly once: nothing due by week 2 runs again.
  expect(
    (await priya.mutation(api.demo.setClock, { target: "complete" })).applied,
  ).toEqual(Object.keys(SCHEDULE).filter((key) => !dueByWeek2.includes(key)));
  const end = await snapshot(t, orgId);
  expect(end.saved).toBe(6);
  expect(end.presented).toEqual([
    "Dan Okafor",
    "Mei Tanaka",
    "Sarah Whitlock",
    "Tomás Reyes",
    "Aisha Karimi",
    "Luca Bianchi",
  ]);
  expect(end.signatures).toBe(8);
  // 5 before and 7 after, at the threshold: the outcomes screen's numbers (spec 3.3).
  expect(end.outcomes).toEqual({ before: [2.8, 2.6], after: [4, 3.9] });

  const rows = await t.run((ctx) =>
    ctx.db
      .query("demoScript")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(rows.every((row) => row.appliedAt !== undefined)).toBe(true);
});

test("the sprint completes automatically when the clock passes the end of the week 4 hour", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");

  await priya.mutation(api.demo.setClock, { target: "week4" });
  const during = await sprintOf(t, orgId);
  expect(during.status).toBe("active");
  expect(during.completedAt).toBeUndefined();

  // The week 4 hour is Wednesday 30 September, 2:00 to 3:00 PM.
  const hourEnds = mel("2026-09-30T15:00");
  expect(SCHEDULE["sprint.complete"]).toBeGreaterThan(hourEnds);
  expect(DEMO_TARGETS.complete).toBeGreaterThan(hourEnds);

  await priya.mutation(api.demo.setClock, { target: "complete" });
  expect(await sprintOf(t, orgId)).toMatchObject({
    status: "complete",
    completedAt: SCHEDULE["sprint.complete"],
  });
});

test("an employee can move the demo clock", async () => {
  const { orgId, as, t } = await calderLane();
  // Dan has a seat once he joins (8 September).
  await as("priya").mutation(api.demo.setClock, { target: "week1" });

  const result = await as("dan").mutation(api.demo.setClock, {
    target: "week2",
  });
  expect(result.demoNow).toBe(DEMO_TARGETS.week2);
  expect(result.applied).toContain("week1.session");
  expect((await t.run((ctx) => ctx.db.get(orgId)))!.demoNow).toBe(
    DEMO_TARGETS.week2,
  );
});

/**
 * P4 to P6 add the mutations a tester uses; until then this writes the rows
 * those mutations write. What is under test is the script's side.
 */
test("setClock keeps the tester's own choices", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");

  // As Priya, before any step: a Thursday 10:00 hour, and a bigger team.
  const committedAt = mel("2026-09-01T09:45");
  await t.run(async (ctx) => {
    const sprint = (await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.patch(sprint._id, {
      protectedHour: { weekday: 4, start: "10:00", durationMinutes: 60 },
      committedAt,
    });
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.patch(team._id, { sizeBand: "11 to 20" });
  });

  await priya.mutation(api.demo.setClock, { target: "week1" });
  const setup = await t.run(async (ctx) => ({
    sprint: await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
    team: await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
    commits: (
      await ctx.db
        .query("events")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).filter((e) => e.type === "hour.committed").length,
  }));
  expect(setup.sprint).toMatchObject({
    protectedHour: { weekday: 4, start: "10:00", durationMinutes: 60 },
    committedAt,
  });
  expect(setup.commits).toBe(0);
  // Her choice stays; the blanks around it are filled.
  expect(setup.team).toMatchObject({
    sizeBand: "11 to 20",
    industry: "Professional services",
  });

  // As Dan, after he joins: 90% through the course, and his own project,
  // kept private.
  const dan = await personId(t, orgId, "dan.okafor@calderlane.com.au");
  await t.run(async (ctx) => {
    const sprint = (await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.insert("learningProgress", {
      orgId,
      personId: dan,
      sprintId: sprint._id,
      sessionsDone: 1,
      percent: 90,
      updatedAt: DEMO_TARGETS.week1,
    });
    await ctx.db.insert("projects", {
      orgId,
      personId: dan,
      sprintId: sprint._id,
      startedWeek: 1,
      title: "My own task",
      before: "",
      change: "",
      after: "",
      resultTypes: [],
      humanReviewed: false,
      dataSafe: false,
      status: "draft",
      sharing: "private",
      autosavedAt: DEMO_TARGETS.week1,
    });
  });

  await priya.mutation(api.demo.setClock, { target: "week2" });
  expect((await snapshot(t, orgId)).percent["Dan Okafor"]).toBe(90);

  await priya.mutation(api.demo.setClock, { target: "complete" });
  // His project, his words, and no safety check ticked for him.
  expect(await projectOf(t, orgId, dan)).toMatchObject({
    title: "My own task",
    sharing: "private",
    humanReviewed: false,
    dataSafe: false,
  });
  const end = await snapshot(t, orgId);
  expect(end.presented).not.toContain("Dan Okafor");
  expect(end.presented).toHaveLength(5);

  await expect(
    priya.mutation(api.demo.setClock, { target: "week1" }),
  ).rejects.toMatchObject({ data: { code: "DEMO_CLOCK_BACKWARDS" } });
});

test("setClock never ticks the safety checks on a project the tester edited", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.demo.setClock, { target: "week2" });

  // As Mei: her own words in the draft the script started for her.
  const mei = await personId(t, orgId, "mei.tanaka@calderlane.com.au");
  const draft = await projectOf(t, orgId, mei);
  await t.run((ctx) => ctx.db.patch(draft._id, { after: "My own words." }));

  await priya.mutation(api.demo.setClock, { target: "complete" });
  expect(await projectOf(t, orgId, mei)).toMatchObject({
    after: "My own words.",
    humanReviewed: false,
    dataSafe: false,
    status: "draft",
  });
  const end = await snapshot(t, orgId);
  expect(end.presented).not.toContain("Mei Tanaka");
  expect(end.saved).toBe(5);
});

test("Dan's reflection is left alone when the tester renamed his project", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  // His project is saved on 29 September.
  await priya.mutation(api.demo.setClock, { target: "week4" });

  const dan = await personId(t, orgId, "dan.okafor@calderlane.com.au");
  const saved = await projectOf(t, orgId, dan);
  expect(saved.status).toBe("saved");
  await t.run((ctx) => ctx.db.patch(saved._id, { title: "My weekly report" }));

  await priya.mutation(api.demo.setClock, { target: "complete" });
  const project = await projectOf(t, orgId, dan);
  expect(project.title).toBe("My weekly report");
  expect(project.learned).toBeUndefined();
  expect(project.howChecked).toBeUndefined();
  const badge = await t.run((ctx) =>
    ctx.db
      .query("badges")
      .withIndex("by_person", (q) => q.eq("personId", dan))
      .unique(),
  );
  expect(badge?.reflectionProjectId).toBeUndefined();
});

test("the demo script never touches a non-demo workspace", async () => {
  const { t, as } = await calderLane();
  const { owner, orgId: realId } = await workspace(t);
  // A real workspace carrying demo-looking fields must still be left alone.
  await t.run(async (ctx) => {
    await ctx.db.patch(realId, { demoNow: DEMO_TARGETS.setup });
    await ctx.db.insert("demoScript", {
      orgId: realId,
      key: "priya.team",
      at: DEMO_TARGETS.setup + 1,
    });
  });

  await expect(
    owner.mutation(api.demo.setClock, { target: "complete" }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  await expect(owner.mutation(api.demo.reset, {})).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });

  await as("priya").mutation(api.demo.setClock, { target: "complete" });

  const counts = await t.run(async (ctx) => {
    const out: Record<string, number> = {};
    for (const table of ORG_TABLES) {
      out[table] = (
        await ctx.db
          .query(table as "teams")
          .withIndex("by_org", (q) => q.eq("orgId", realId))
          .collect()
      ).length;
    }
    return out;
  });
  expect(counts).toEqual({
    ...Object.fromEntries(ORG_TABLES.map((table) => [table, 0])),
    demoScript: 1,
  });
  const real = await t.run(async (ctx) => ({
    org: (await ctx.db.get(realId))!,
    script: await ctx.db
      .query("demoScript")
      .withIndex("by_org", (q) => q.eq("orgId", realId))
      .unique(),
  }));
  expect(real.script?.appliedAt).toBeUndefined();
  // Real time, not the stray demo clock.
  expect(Math.abs(nowFor(real.org) - Date.now())).toBeLessThan(5_000);
});

test("the demo clock is refused when demo mode is off", async () => {
  const { t, orgId, as } = await calderLane();
  const org = (await t.run((ctx) => ctx.db.get(orgId)))!;
  expect(nowFor(org)).toBe(DEMO_TARGETS.setup);

  vi.stubEnv("DEMO_MODE", "");
  await expect(
    as("priya").mutation(api.demo.setClock, { target: "week1" }),
  ).rejects.toMatchObject({ data: { code: "FEATURE_UNAVAILABLE" } });
  expect(Math.abs(nowFor(org) - Date.now())).toBeLessThan(5_000);
});
