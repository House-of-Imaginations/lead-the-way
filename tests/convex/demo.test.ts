import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, components, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { latestSaved } from "../../convex/lib/agreement";
import { nowFor } from "../../convex/lib/clock";
import {
  DEMO_NOW,
  DEMO_TARGETS,
  SCHEDULE,
  mel,
} from "../../convex/lib/demo/schedule";
import { INVITE_WINDOW_MS } from "../../convex/lib/orgs/invites";
import { ORG_TABLES } from "../../convex/lib/orgs/cascade";
import { castOf } from "../../convex/lib/demo/cast";
import { aggregate, loadCountable } from "../../convex/lib/privacy";
import { isPresented } from "../../convex/lib/projects";
import { RESULT_TYPES } from "../../convex/lib/projectLimits";
import { DEFAULT_SETTINGS } from "../../convex/lib/settings";
import { recordSkip, upsertAnswer } from "../../convex/lib/surveys";
import { getViewer } from "../../convex/lib/viewer";
import { calderLane, harness, workspace, type T } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const DAN = "dan.okafor@calderlane.com.au";

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

async function eventsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

async function signaturesOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("agreementSignatures")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

async function teamOf(t: T, orgId: Id<"orgs">) {
  return (await t.run((ctx) =>
    ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
  ))!;
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
    const priya = people.find((p) => p.email === castOf("priya").email);
    const invites = await ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
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
      // Priya is the one asking, on the outcomes screen.
      const result = aggregate(
        await loadCountable(ctx, org, priya?._id ?? null),
        (p) => rows.find((r) => r.personId === p._id)?.score,
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
    (
      await priya.mutation(api.demo.setClock, {
        target: "week2",
        expectOrgId: orgId,
      })
    ).applied,
  ).toEqual(dueByWeek2);

  const week2 = await snapshot(t, orgId);
  expect(week2.people).toHaveLength(8);
  expect(week2.invites).toBe(8);
  expect(week2.pending).toEqual(["Omar Haddad"]);
  expect(week2.finishedWeek1).toBe(6);
  expect(week2.drafts).toBe(5);
  expect(week2.percent["Dan Okafor"]).toBe(60);
  expect(week2.signatures).toBe(8);

  // The same target again applies nothing and changes nothing.
  expect(
    (
      await priya.mutation(api.demo.setClock, {
        target: "week2",
        expectOrgId: orgId,
      })
    ).applied,
  ).toEqual([]);
  expect(await snapshot(t, orgId)).toEqual(week2);

  // The rest, each exactly once: nothing due by week 2 runs again.
  expect(
    (
      await priya.mutation(api.demo.setClock, {
        target: "complete",
        expectOrgId: orgId,
      })
    ).applied,
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

  // Each presentation is logged when it happened, and a script save says
  // what it filled, as a product save does (spec 5).
  const events = await eventsOf(t, orgId);
  const presentedAt = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("projects")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    )
      .map((p) => p.presentedAt!)
      .sort((a, b) => a - b),
  );
  expect(
    events
      .filter((e) => e.type === "project.presented")
      .map((e) => e.at)
      .sort((a, b) => a - b),
  ).toEqual(presentedAt);
  const saves = events.filter((e) => e.type === "project.saved");
  expect(saves).toHaveLength(6);
  expect(saves.every((e) => e.meta?.fieldsFilled === 3)).toBe(true);

  // Dan's reflection is added to his badge (spec 6).
  const dan = await personId(t, orgId, DAN);
  const project = await projectOf(t, orgId, dan);
  expect(project).toMatchObject({
    learned:
      "AI helped speed up the first draft, but I still needed to verify the client metrics manually.",
    howChecked:
      "I compared every figure in the draft with the account system before sending.",
  });
  const badge = await t.run((ctx) =>
    ctx.db
      .query("badges")
      .withIndex("by_person", (q) => q.eq("personId", dan))
      .unique(),
  );
  expect(badge?.reflectionProjectId).toBe(project._id);

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

  await priya.mutation(api.demo.setClock, {
    target: "week4",
    expectOrgId: orgId,
  });
  const during = await sprintOf(t, orgId);
  // Nothing writes `status` (Ruling 11): the phase comes from the clock.
  expect(during.status).toBeUndefined();
  expect(during.completedAt).toBeUndefined();

  // The week 4 hour is Wednesday 30 September, 2:00 to 3:00 PM.
  const hourEnds = mel("2026-09-30T15:00");
  expect(SCHEDULE["sprint.complete"]).toBeGreaterThan(hourEnds);
  expect(DEMO_TARGETS.complete).toBeGreaterThan(hourEnds);

  await priya.mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });
  const done = await sprintOf(t, orgId);
  expect(done.completedAt).toBe(SCHEDULE["sprint.complete"]);
  expect(done.status).toBeUndefined();
});

test("the seeded projects only use result types the form offers", async () => {
  const { t, orgId, as } = await calderLane();
  await as("priya").mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });
  const rows = await t.run((ctx) =>
    ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(rows.length).toBeGreaterThan(0);
  const offered: readonly string[] = RESULT_TYPES;
  for (const row of rows) {
    for (const type of row.resultTypes) expect(offered).toContain(type);
  }
});

test("an employee can move the demo clock", async () => {
  const { orgId, as, t } = await calderLane();
  // Dan has a seat once he joins (8 September).
  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });

  const result = await as("dan").mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
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

  await priya.mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
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
    // The option wireframe 03 selects.
    aiUse: "Advanced users, inconsistent practices",
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

  await priya.mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
  });
  expect((await snapshot(t, orgId)).percent["Dan Okafor"]).toBe(90);

  await priya.mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });
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
    priya.mutation(api.demo.setClock, { target: "week1", expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "DEMO_CLOCK_BACKWARDS" } });
});

test("setClock never ticks the safety checks on a project the tester edited", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
  });

  // As Mei: her own words in the draft the script started for her.
  const mei = await personId(t, orgId, "mei.tanaka@calderlane.com.au");
  const draft = await projectOf(t, orgId, mei);
  await t.run((ctx) => ctx.db.patch(draft._id, { after: "My own words." }));

  await priya.mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });
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
  await priya.mutation(api.demo.setClock, {
    target: "week4",
    expectOrgId: orgId,
  });

  const dan = await personId(t, orgId, "dan.okafor@calderlane.com.au");
  const saved = await projectOf(t, orgId, dan);
  expect(saved.status).toBe("saved");
  await t.run((ctx) => ctx.db.patch(saved._id, { title: "My weekly report" }));

  await priya.mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });
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
  const { t, orgId, as } = await calderLane();
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
    owner.mutation(api.demo.setClock, {
      target: "complete",
      expectOrgId: realId,
    }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  await expect(
    owner.mutation(api.demo.reset, { expectOrgId: realId }),
  ).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });

  await as("priya").mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });

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
    teams: 1,
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
    as("priya").mutation(api.demo.setClock, {
      target: "week1",
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "FEATURE_UNAVAILABLE" } });
  expect(Math.abs(nowFor(org) - Date.now())).toBeLessThan(5_000);
});

test("a saved agreement stands, even with a newer draft on top", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = await personId(t, orgId, "priya.raman@calderlane.com.au");
  // As Priya on 1 September: she saved v1, then started editing v2.
  const { v1, v2 } = await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    const base = {
      orgId,
      teamId: team._id,
      tools: ["Microsoft Copilot"],
      neverIn: [],
      checks: [],
      escalation: "Ask Priya first.",
      contact: { kind: "person" as const, personId: priya },
    };
    return {
      v1: await ctx.db.insert("agreements", {
        ...base,
        version: 1,
        status: "saved",
        savedAt: DEMO_NOW,
        savedBy: priya,
      }),
      v2: await ctx.db.insert("agreements", {
        ...base,
        version: 2,
        status: "draft",
        escalation: "",
      }),
    };
  });

  await as("priya").mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
  });
  const draft = await t.run((ctx) => ctx.db.get(v2));
  expect(draft).toMatchObject({ status: "draft", escalation: "" });
  expect(draft?.savedBy).toBeUndefined();
  const signatures = await signaturesOf(t, orgId);
  expect(signatures).toHaveLength(8);
  expect(signatures.every((s) => s.agreementId === v1 && s.version === 1)).toBe(
    true,
  );
  expect(
    (await eventsOf(t, orgId)).filter((e) => e.type === "agreement.saved"),
  ).toEqual([]);
});

test("a tester playing Dan can sign the agreement before the script does", async () => {
  const { t, orgId, as } = await calderLane();
  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const dan = await personId(t, orgId, DAN);
  const signed = await signaturesOf(t, orgId);
  expect(signed).toHaveLength(7);
  expect(signed.some((s) => s.personId === dan)).toBe(false);

  // As Dan, at 1:10 PM on 9 September.
  const signedAt = mel("2026-09-09T13:10");
  await t.run(async (ctx) => {
    const agreement = (await ctx.db
      .query("agreements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    await ctx.db.insert("agreementSignatures", {
      orgId,
      agreementId: agreement._id,
      version: agreement.version,
      personId: dan,
      signedAt,
    });
  });

  await as("priya").mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
  });
  const all = await signaturesOf(t, orgId);
  expect(all).toHaveLength(8);
  expect(all.filter((s) => s.personId === dan).map((s) => s.signedAt)).toEqual([
    signedAt,
  ]);
});

test("the script leaves a team the tester saved as it is", async () => {
  const { t, orgId, as } = await calderLane();
  const savedAt = mel("2026-09-01T09:40");
  const team = await teamOf(t, orgId);
  await t.run((ctx) => ctx.db.patch(team._id, { sizeBand: "2 to 5", savedAt }));

  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const after = await teamOf(t, orgId);
  expect(after).toMatchObject({ sizeBand: "2 to 5", savedAt, challenges: [] });
  expect(after.industry).toBeUndefined();
  expect(after.aiUse).toBeUndefined();
});

test("the script doesn't commit the hour over a 'not ready'", async () => {
  const { t, orgId, as } = await calderLane();
  const sprint = await sprintOf(t, orgId);
  const notReady = { at: mel("2026-09-01T09:40"), reason: "Too busy" };
  await t.run((ctx) => ctx.db.patch(sprint._id, { notReady }));

  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const after = await sprintOf(t, orgId);
  expect(after.notReady).toEqual(notReady);
  expect(after.committedAt).toBeUndefined();
  expect(
    (await eventsOf(t, orgId)).filter((e) => e.type === "hour.committed"),
  ).toEqual([]);
});

test("without Employee, the script invites into the custom role with the fewest permissions", async () => {
  const { t, orgId, as } = await calderLane();
  // As Priya: a lead role first, then Employee replaced by "Team member".
  const member = await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    await ctx.db.delete(roles.find((r) => r.name === "Employee")!._id);
    await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Team lead",
      permissions: ["members:manage", "team:insights"],
      createdAt: DEMO_NOW,
    });
    return await ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Team member",
      permissions: [],
      createdAt: DEMO_NOW,
    });
  });

  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const invites = await t.run((ctx) =>
    ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(invites).toHaveLength(8);
  expect(invites.every((i) => i.roleId === member)).toBe(true);
});

test("a revoked invitation keeps that teammate out", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  const employee = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("orgRoles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).find((r) => r.name === "Employee")!,
  );
  // As Priya: she invites Sarah, then thinks better of it.
  const { inviteId } = await priya.mutation(api.invites.create, {
    roleId: employee._id,
    email: "sarah.whitlock@calderlane.com.au",
    expectOrgId: orgId,
  });
  await priya.mutation(api.invites.revoke, { inviteId, expectOrgId: orgId });

  await priya.mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const state = await snapshot(t, orgId);
  expect(state.people).not.toContain("Sarah Whitlock");
  expect(state.people).toHaveLength(7);
  expect((await t.run((ctx) => ctx.db.get(inviteId)))?.status).toBe("revoked");
});

test("a tester's own survey answer is kept", async () => {
  const { t, orgId, as } = await calderLane();
  // Dan joins on 8 September and answers the before check-in late (1:30 PM).
  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const dan = await personId(t, orgId, DAN);
  const sprint = await sprintOf(t, orgId);
  // As Dan, before the script answers for him.
  await t.run(async (ctx) => {
    for (const question of ["aiConfidence", "comfortWithManager"] as const) {
      await ctx.db.insert("surveyResponses", {
        orgId,
        sprintId: sprint._id,
        personId: dan,
        phase: "before",
        question,
        score: 5,
      });
    }
  });

  await as("priya").mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
  });
  const mine = await t.run((ctx) =>
    ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", dan).eq("sprintId", sprint._id),
      )
      .collect(),
  );
  expect(mine.map((r) => [r.phase, r.question, r.score])).toEqual([
    ["before", "aiConfidence", 5],
    ["before", "comfortWithManager", 5],
  ]);
});

test("a reset after the end starts the demo again on 1 September", async () => {
  const { t, orgId: firstId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: firstId,
  });

  await priya.mutation(api.demo.reset, { expectOrgId: firstId });
  const orgId = (await priya.query(api.orgs.active, {}))!.org._id;
  expect((await t.run((ctx) => ctx.db.get(orgId)))?.demoNow).toBe(DEMO_NOW);
  const rows = await t.run((ctx) =>
    ctx.db
      .query("demoScript")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(rows.map((row) => row.key)).toEqual(Object.keys(SCHEDULE));
  expect(rows.every((row) => row.appliedAt === undefined)).toBe(true);
});

test("a missing demo account says to reseed", async () => {
  const { t, orgId, as } = await calderLane();
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: {
        model: "user",
        where: [{ field: "email", value: "grace.oyelaran@calderlane.com.au" }],
      },
    }),
  );
  const priya = as("priya");
  // Grace joins on 8 September.
  await expect(
    priya.mutation(api.demo.setClock, { target: "week1", expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "DEMO_NOT_SEEDED" } });
  await expect(
    priya.mutation(api.demo.reset, { expectOrgId: orgId }),
  ).rejects.toMatchObject({
    data: { code: "DEMO_NOT_SEEDED" },
  });
});

test("a broken demo workspace says to reset, in words the client gets", async () => {
  const { t, orgId, as } = await calderLane();
  await t.run(async (ctx) => {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique();
    await ctx.db.delete(team!._id);
  });
  await expect(
    as("priya").mutation(api.demo.setClock, {
      target: "week1",
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({
    data: {
      code: "DEMO_BROKEN",
      message: "The demo workspace has no team. Reset the demo.",
    },
  });
});

test("the demo workspace can't be deleted in the app", async () => {
  const { t, orgId, as } = await calderLane();
  await expect(
    as("priya").mutation(api.orgs.remove, { expectOrgId: orgId }),
  ).rejects.toMatchObject({
    data: { code: "FORBIDDEN", message: "Reset the demo instead." },
  });
  expect(await t.run((ctx) => ctx.db.get(orgId))).not.toBeNull();
});

test("demo invitations expire by the demo clock, not real time", async () => {
  const { orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  // Omar never joins, so his invitation stays open.
  const pending = async () =>
    (await priya.query(api.invites.list, {}))
      .filter((i) => i.status === "pending")
      .map((i) => i.name);
  expect(await pending()).toEqual(["Omar Haddad"]);

  // Real time runs past the week the link was minted with; the demo clock
  // is still 9 September.
  vi.setSystemTime(Date.now() + INVITE_WINDOW_MS + 60_000);
  expect(await pending()).toEqual(["Omar Haddad"]);
});

test("what a tester does in the demo is stamped with demo time", async () => {
  const { t, orgId, as } = await calderLane();
  const employee = await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return roles.find((r) => r.name === "Employee")!._id;
  });
  // A shareable link, made and taken up on Tuesday 1 September.
  const { inviteId, token } = await as("priya").mutation(api.invites.create, {
    roleId: employee,
    expectOrgId: orgId,
  });
  await as("dan").mutation(api.invites.accept, { token });

  const dan = await personId(t, orgId, DAN);
  const stamps = await t.run(async (ctx) => ({
    invite: await ctx.db.get(inviteId),
    dan: await ctx.db.get(dan),
  }));
  expect(stamps.invite).toMatchObject({
    createdAt: DEMO_NOW,
    respondedAt: DEMO_NOW,
  });
  expect(stamps.dan?.createdAt).toBe(DEMO_NOW);
  // Product functions read the same clock from the viewer.
  expect(await as("dan").run(async (ctx) => (await getViewer(ctx))?.now)).toBe(
    DEMO_NOW,
  );
});

test("a demo persona can't make a workspace while the demo is on", async () => {
  const { as } = await calderLane();
  await expect(
    as("dan").mutation(api.orgs.create, { name: "Okafor Network" }),
  ).rejects.toMatchObject({ data: { code: "DEMO_ACCOUNT_CREATE" } });

  vi.stubEnv("DEMO_MODE", "");
  await expect(
    as("dan").mutation(api.orgs.create, { name: "Okafor Network" }),
  ).resolves.toMatchObject({ slug: "okafor-network" });
});

test("a demo persona can't join a real workspace while the demo is on", async () => {
  const { t, as } = await calderLane();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, {});
  const employee = roles.find((r) => r.name === "Employee")!._id;
  const { token } = await owner.mutation(api.invites.create, {
    roleId: employee,
    expectOrgId: orgId,
  });
  await expect(
    as("dan").mutation(api.invites.accept, { token }),
  ).rejects.toMatchObject({ data: { code: "DEMO_ACCOUNT_JOIN" } });

  vi.stubEnv("DEMO_MODE", "");
  await expect(
    as("dan").mutation(api.invites.accept, { token }),
  ).resolves.toMatchObject({ orgId });
});

test("a demo mutation refuses when the caller's workspace changed", async () => {
  const { t, orgId, as } = await calderLane();
  // Another tab still shows a different workspace than the one Priya has open.
  const { orgId: otherId } = await workspace(t);
  await expect(
    as("priya").mutation(api.demo.setClock, {
      target: "week1",
      expectOrgId: otherId,
    }),
  ).rejects.toMatchObject({
    data: {
      code: "WORKSPACE_CHANGED",
      message:
        "You switched workspace in another tab. Reload the page to continue.",
    },
  });
  expect((await t.run((ctx) => ctx.db.get(orgId)))?.demoNow).toBe(DEMO_NOW);
});

test("personaPassword answers a signed-in caller only while the demo is on", async () => {
  const t = harness();
  const bec = t.withIdentity({ subject: "user_bec" });
  vi.stubEnv("DEMO_PASSWORD", "correct horse battery");
  await expect(t.query(api.demo.personaPassword, {})).rejects.toMatchObject({
    data: { code: "NOT_SIGNED_IN" },
  });
  expect(await bec.query(api.demo.personaPassword, {})).toBe(
    "correct horse battery",
  );
  vi.stubEnv("DEMO_MODE", "");
  expect(await bec.query(api.demo.personaPassword, {})).toBeNull();
  vi.stubEnv("DEMO_MODE", "on");
  vi.stubEnv("DEMO_PASSWORD", "");
  expect(await bec.query(api.demo.personaPassword, {})).toBeNull();
});

test("seed:clock moves the demo clock without a persona", async () => {
  const { t, orgId } = await calderLane();
  const { demoNow, applied } = await t.mutation(internal.seed.clock, {
    target: "week2",
  });
  expect(demoNow).toBe(DEMO_TARGETS.week2);
  expect(applied).toContain("priya.launch");
  expect((await t.run((ctx) => ctx.db.get(orgId)))?.demoNow).toBe(
    DEMO_TARGETS.week2,
  );
  vi.stubEnv("DEMO_MODE", "");
  await expect(
    t.mutation(internal.seed.clock, { target: "week3" }),
  ).rejects.toMatchObject({ data: { code: "FEATURE_UNAVAILABLE" } });
});

test("seed:clock says to seed first when there is no demo", async () => {
  const t = harness();
  await expect(
    t.mutation(internal.seed.clock, { target: "week1" }),
  ).rejects.toMatchObject({ data: { code: "DEMO_NOT_SEEDED" } });
});

test("a demo persona is refused a real workspace's invitation up front", async () => {
  const { t, as } = await calderLane();
  const { owner, orgId } = await workspace(t);
  const roles = await owner.query(api.orgRoles.list, {});
  const roleId = roles.find((r) => r.name === "Employee")!._id;
  const { inviteId, token } = await owner.mutation(api.invites.create, {
    roleId,
    expectOrgId: orgId,
  });
  const dan = as("dan");

  expect((await dan.query(api.invites.preview, { token }))?.acceptState).toBe(
    "DEMO_ACCOUNT",
  );
  await expect(
    dan.mutation(api.invites.decline, { token }),
  ).rejects.toMatchObject({
    data: {
      code: "DEMO_ACCOUNT_JOIN",
      message:
        "Demo accounts can't answer invitations to other workspaces. Log in with your own account instead.",
    },
  });
  // The link is still there for the person it was meant for.
  expect((await t.run((ctx) => ctx.db.get(inviteId)))?.status).toBe("pending");

  // With the demo off, Dan's account is an ordinary account.
  vi.stubEnv("DEMO_MODE", "");
  expect((await dan.query(api.invites.preview, { token }))?.acceptState).toBe(
    "READY",
  );
});

test("a draft team keeps the tester's answers after a clock jump", async () => {
  const { t, orgId, as } = await calderLane();
  const team = await teamOf(t, orgId);
  // As Priya: page 1 half filled, then Save and exit (a draft, no savedAt).
  await t.run((ctx) =>
    ctx.db.patch(team._id, {
      sizeBand: "2 to 5",
      challenges: ["Lack of time to learn"],
    }),
  );

  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  expect(await teamOf(t, orgId)).toMatchObject({
    // Hers, kept.
    sizeBand: "2 to 5",
    challenges: ["Lack of time to learn"],
    // The blanks, filled by the script at 10:00 on 1 September.
    industry: "Professional services",
    teamFunction: "Client service",
    aiUse: "Advanced users, inconsistent practices",
    savedAt: SCHEDULE["priya.team"],
  });
});

test("a skipped rating stays skipped after a jump", async () => {
  const { t, orgId, as } = await calderLane();
  const team = await teamOf(t, orgId);
  const priya = await personId(t, orgId, castOf("priya").email);
  // As Priya: she saves page 2 without a rating, and finishes the required
  // modules without answering "Ready to launch?".
  await t.run(async (ctx) => {
    await ctx.db.patch(team._id, { savedAt: mel("2026-09-01T09:40") });
    for (const [moduleKey, minutes] of [
      ["shared-norms", 5],
      ["without-micromanaging", 10],
      ["team-agreement", 10],
    ] as const) {
      await ctx.db.insert("pathwayProgress", {
        orgId,
        personId: priya,
        moduleKey,
        minutesWatched: minutes,
        completedAt: mel("2026-09-01T09:45"),
      });
    }
  });

  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const sprint = await sprintOf(t, orgId);
  const mine = await t.run((ctx) =>
    ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", priya).eq("sprintId", sprint._id),
      )
      .collect(),
  );
  expect(mine.filter((r) => r.question === "normsConfidence")).toEqual([]);
});

test("the scripted team.join logs through joinByInvite", async () => {
  const { t, orgId, as } = await calderLane();
  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const joinedAt = SCHEDULE["team.join"];
  const accepted = (await eventsOf(t, orgId)).filter(
    (e) => e.type === "invite.accepted",
  );
  // Seven of the eight join (Omar stays invited), each through joinByInvite.
  expect(accepted).toHaveLength(7);
  expect(accepted.every((e) => e.at === joinedAt)).toBe(true);
  const sprint = await sprintOf(t, orgId);
  expect(accepted.every((e) => e.sprintId === sprint._id)).toBe(true);
  // And the seat, the answered invitation and the open workspace with it.
  const dan = await as("dan").run((ctx) => getViewer(ctx));
  expect(dan?.org._id).toBe(orgId);
  const invites = await t.run((ctx) =>
    ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) =>
        q.eq("orgId", orgId).eq("status", "accepted"),
      )
      .collect(),
  );
  expect(invites.find((i) => i.personId === dan?.person._id)).toMatchObject({
    respondedAt: joinedAt,
  });
});

test("a skipped check-in is not a response (Review Focus 3)", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  // Sarah, Mei, Tomás and Aisha have answered; Dan's answer is due at 1:30 PM.
  await priya.mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const dan = await personId(t, orgId, DAN);
  const sprint = await sprintOf(t, orgId);
  const key = { orgId, sprintId: sprint._id, personId: dan };
  const skippedAt = mel("2026-09-09T13:10");
  // As Dan, at 1:10 PM: "Skip for now".
  await t.run((ctx) =>
    recordSkip(ctx, { ...key, phase: "before", at: skippedAt }),
  );
  await priya.mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
  });

  // A row each, so the script left him alone, and no score in either.
  const rows = await t.run((ctx) =>
    ctx.db
      .query("surveyResponses")
      .withIndex("by_person_and_sprint", (q) =>
        q.eq("personId", dan).eq("sprintId", sprint._id),
      )
      .collect(),
  );
  expect(rows.map((r) => [r.phase, r.question, r.score, r.skippedAt])).toEqual([
    ["before", "aiConfidence", undefined, skippedAt],
    ["before", "comfortWithManager", undefined, skippedAt],
  ]);
  // 4 answers and a skip is 4 responses, below 5: hidden. `aggregate` needs
  // no filter, because a skip row's `score` is undefined and `valueOf`
  // passes that through (`snapshot` reads exactly as P7's outcomes will).
  expect((await snapshot(t, orgId)).outcomes.before).toEqual([null, null]);
  expect(
    (await eventsOf(t, orgId)).filter(
      (e) => e.type === "survey.answered" && e.meta?.phase === "before",
    ),
  ).toHaveLength(4);

  // He answers after all: the answer replaces the skip, and five show.
  await t.run(async (ctx) => {
    for (const [question, score] of [
      ["aiConfidence", 3],
      ["comfortWithManager", 2],
    ] as const) {
      await upsertAnswer(ctx, {
        ...key,
        phase: "before",
        question,
        score,
        at: DEMO_TARGETS.week2,
      });
    }
  });
  expect((await snapshot(t, orgId)).outcomes.before).toEqual([2.8, 2.6]);
});

test("the script leaves Dan's own choices alone (Review Focus 4)", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  await priya.mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const dan = await personId(t, orgId, DAN);
  const sprint = await sprintOf(t, orgId);
  // As Dan at 1:10 PM on 9 September, before the script answers (1:30 PM)
  // and signs (1:45 PM) for him: he signs, skips the check-in and turns
  // reflections on his credential off.
  const at = mel("2026-09-09T13:10");
  const team = await teamOf(t, orgId);
  await t.run(async (ctx) => {
    const agreement = (await latestSaved(ctx, team._id))!;
    await ctx.db.insert("agreementSignatures", {
      orgId,
      agreementId: agreement._id,
      version: agreement.version,
      personId: dan,
      signedAt: at,
    });
    await recordSkip(ctx, {
      orgId,
      sprintId: sprint._id,
      personId: dan,
      phase: "before",
      at,
    });
    await ctx.db.insert("settings", {
      orgId,
      personId: dan,
      ...DEFAULT_SETTINGS,
      reflectionsOnCredential: false,
    });
  });
  // His project is saved on 29 September, still private. He renames it
  // before the show and tell.
  await priya.mutation(api.demo.setClock, {
    target: "week4",
    expectOrgId: orgId,
  });
  const saved = await projectOf(t, orgId, dan);
  expect(saved).toMatchObject({ status: "saved", sharing: "private" });
  await t.run((ctx) => ctx.db.patch(saved._id, { title: "My weekly report" }));
  await priya.mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });

  const own = await t.run(async (ctx) => {
    const mine = async <R extends { personId: Id<"people"> }>(
      rows: Promise<R[]>,
    ) => (await rows).filter((r) => r.personId === dan);
    return {
      signatures: await mine(
        ctx.db
          .query("agreementSignatures")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
      ),
      progress: await mine(
        ctx.db
          .query("learningProgress")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
      ),
      projects: await mine(
        ctx.db
          .query("projects")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
      ),
      answers: await mine(
        ctx.db
          .query("surveyResponses")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
      ),
      badges: await mine(
        ctx.db
          .query("badges")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect(),
      ),
    };
  });
  // One row per table, and each says what Dan did.
  expect(own.signatures.map((s) => s.signedAt)).toEqual([at]);
  expect(own.progress).toHaveLength(1);
  expect(own.projects).toHaveLength(1);
  expect(own.projects[0]).toMatchObject({
    title: "My weekly report",
    sharing: "private",
  });
  expect(own.projects[0]?.presentedAt).toBeUndefined();
  expect(own.projects[0]?.learned).toBeUndefined();
  // The skip stands. The after check-in is a separate answer, which the
  // script still gives for him at 3:30 PM.
  expect(
    own.answers.map((r) => [r.phase, r.question, r.score, r.skippedAt]),
  ).toEqual([
    ["before", "aiConfidence", undefined, at],
    ["before", "comfortWithManager", undefined, at],
    ["after", "aiConfidence", 4, undefined],
    ["after", "comfortWithManager", 4, undefined],
  ]);
  expect(own.badges).toHaveLength(1);
  expect(own.badges[0]).toMatchObject({
    shareSlug: "dan-okafor-ai-fundamentals",
  });
  expect(own.badges[0]?.reflectionProjectId).toBeUndefined();

  const events = await eventsOf(t, orgId);
  expect(
    events.filter(
      (e) => e.type === "survey.answered" && e.meta?.phase === "before",
    ),
  ).toHaveLength(4);
  expect(events.filter((e) => e.type === "project.presented")).toHaveLength(5);
  const end = await snapshot(t, orgId);
  expect(end.presented).not.toContain("Dan Okafor");
  // Everybody signed once; Dan's is the one above.
  expect(end.signatures).toBe(8);
  expect(end.outcomes).toEqual({ before: [null, null], after: [4, 3.9] });
});

test("Dan's reflection stays off his badge while his setting is off", async () => {
  const { t, orgId, as } = await calderLane();
  await as("priya").mutation(api.demo.setClock, {
    target: "week1",
    expectOrgId: orgId,
  });
  const dan = await personId(t, orgId, DAN);
  await t.run((ctx) =>
    ctx.db.insert("settings", {
      orgId,
      personId: dan,
      ...DEFAULT_SETTINGS,
      reflectionsOnCredential: false,
    }),
  );
  await as("priya").mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });
  // His canonical project is presented and reflected on; only the link waits.
  expect(await projectOf(t, orgId, dan)).toMatchObject({
    sharing: "team",
    presentedAt: expect.any(Number),
    learned: expect.any(String),
  });
  const badge = await t.run((ctx) =>
    ctx.db
      .query("badges")
      .withIndex("by_person", (q) => q.eq("personId", dan))
      .unique(),
  );
  expect(badge?.shareSlug).toBe("dan-okafor-ai-fundamentals");
  expect(badge?.reflectionProjectId).toBeUndefined();
});

test("drafts start private, and the show and tell shares what it presents (Ruling 4)", async () => {
  const { t, orgId, as } = await calderLane();
  const projects = () =>
    t.run((ctx) =>
      ctx.db
        .query("projects")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
    );
  await as("priya").mutation(api.demo.setClock, {
    target: "week2",
    expectOrgId: orgId,
  });
  expect((await projects()).map((p) => [p.status, p.sharing])).toEqual(
    Array(5).fill(["draft", "private"]),
  );
  // Saved on the 29th, and still private until presented.
  await as("priya").mutation(api.demo.setClock, {
    target: "week4",
    expectOrgId: orgId,
  });
  expect(
    (await projects()).map((p) => [p.status, p.sharing, p.presentedAt]),
  ).toEqual(Array(6).fill(["saved", "private", undefined]));
  await as("priya").mutation(api.demo.setClock, {
    target: "complete",
    expectOrgId: orgId,
  });
  const end = await projects();
  expect(end).toHaveLength(6);
  expect(end.every(isPresented)).toBe(true);
});
