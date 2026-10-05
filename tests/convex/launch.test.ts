import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEMO_CAST, isDemoAddress } from "../../convex/lib/demo/cast";
import { mel } from "../../convex/lib/demo/schedule";
import { PATHWAY_MODULES } from "../../convex/lib/pathway";
import { weekOneDate } from "../../convex/lib/sprintTime";
import { rateLimiter } from "../../convex/lib/rateLimits";
import { personFields, seedAuthUser } from "./testHelpers";
import {
  calderLane,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

/**
 * NEVER IMPORT `convex/lib/email/send.ts` INTO THIS FILE, directly or through
 * another module. `lib/demo/script.ts`, `auth.ts` and `lib/orgs/people.ts` all
 * reach it. Its Resend client reads RESEND_API_KEY once, when it first loads,
 * so the key is stubbed here before the first function call loads it. A real
 * send queues a batch one second out on `setTimeout`. `emailOn` fakes
 * `setTimeout`, so that batch never runs and nothing reaches the network
 * guard. `afterEach` drops the pending timer.
 */
beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** A configured sender: only the product's rules decide whether mail goes. */
function emailOn() {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.stubEnv("RESEND_FROM", "Lead the Way <hello@example.com>");
}

const CAST = DEMO_CAST.filter((p) => p.key !== "priya").map((p) => p.email);
const NOT_READY = {
  data: {
    code: "LAUNCH_NOT_READY",
    message:
      "Protect the hour, finish the pathway and save the agreement first.",
  },
};

async function teamOf(t: T, orgId: Id<"orgs">) {
  return await t.run(
    async (ctx) =>
      (await ctx.db
        .query("teams")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique())!,
  );
}

async function sprintOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first(),
  );
}

/** The hour decided. A real workspace gets a draft sprint first. */
async function commitHour(t: T, orgId: Id<"orgs">) {
  const team = await teamOf(t, orgId);
  await t.run(async (ctx) => {
    const sprint = await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (sprint) {
      await ctx.db.patch(sprint._id, { committedAt: 1 });
      return;
    }
    await ctx.db.insert("sprints", {
      orgId,
      teamId: team._id,
      status: "draft",
      // A past Wednesday: a draft's week one is the later of this and the
      // next working week (Ruling 17, P7a Ruling 14), so launch works it out.
      startDate: "2026-01-07",
      timeZone: "Australia/Melbourne",
      weeks: 4,
      protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
      committedAt: 1,
      courseTitle: "AI Productivity Fundamentals",
      createdAt: 1,
    });
  });
}

/** Every current member finished the required modules. */
async function finishPathway(t: T, orgId: Id<"orgs">) {
  await t.run(async (ctx) => {
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
  });
}

/** Version 1 saved on 7 September, as the script would. */
async function saveAgreement(t: T, orgId: Id<"orgs">) {
  const team = await teamOf(t, orgId);
  await t.run((ctx) =>
    ctx.db.insert("agreements", {
      orgId,
      teamId: team._id,
      version: 1,
      status: "saved",
      tools: [],
      neverIn: [],
      checks: [],
      escalation: "",
      contact: { kind: "label", label: "Privacy officer" },
      savedAt: mel("2026-09-07T11:00"),
    }),
  );
}

async function ready(t: T, orgId: Id<"orgs">) {
  await commitHour(t, orgId);
  await finishPathway(t, orgId);
  await saveAgreement(t, orgId);
}

async function invitesOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("orgInvites")
      .withIndex("by_org_status_and_expiresAt", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

async function launchedEvents(t: T, orgId: Id<"orgs">) {
  const events = await t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  return events.filter((e) => e.type === "sprint.launched");
}

async function employeeRoleId(t: T, orgId: Id<"orgs">) {
  return await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return roles.find((r) => r.name === "Employee")!._id;
  });
}

/** A fresh workspace, and a launch as its owner. */
async function manager() {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const launch = (emails: string[], message = "") =>
    owner.mutation(api.sprints.launch, { emails, message, expectOrgId: orgId });
  return { t, owner, orgId, launch };
}

test("launch refuses until the hour, pathway and agreement are done", async () => {
  const { t, owner, orgId, launch } = await manager();
  await expect(launch(["ana@example.com"])).rejects.toMatchObject(NOT_READY);
  await commitHour(t, orgId);
  expect((await owner.query(api.sprints.launchPage, {}))?.gate).toEqual({
    committed: true,
    pathwayDone: false,
    agreementSaved: false,
  });
  await expect(launch(["ana@example.com"])).rejects.toMatchObject(NOT_READY);
  await finishPathway(t, orgId);
  await expect(launch(["ana@example.com"])).rejects.toMatchObject(NOT_READY);
  await saveAgreement(t, orgId);
  expect((await owner.query(api.sprints.launchPage, {}))?.gate).toEqual({
    committed: true,
    pathwayDone: true,
    agreementSaved: true,
  });
  expect(await launch(["ana@example.com"])).toMatchObject({ invited: 1 });
  expect(await invitesOf(t, orgId)).toHaveLength(1);
});

test("launch invites each address once and returns the count", async () => {
  emailOn();
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);

  const refusals: [string[], string, string][] = [
    [[], "", "Add at least one email address."],
    [["  "], "", "Add at least one email address."],
    [["not-an-email"], "", "Check the email addresses and try again."],
    [
      Array.from({ length: 51 }, (_, i) => `teammate${i}@example.com`),
      "",
      "You can invite at most 50 people at once.",
    ],
    [
      ["ana@example.com"],
      "x".repeat(501),
      "A message can be at most 500 characters.",
    ],
  ];
  for (const [emails, message, text] of refusals) {
    await expect(launch(emails, message), text).rejects.toMatchObject({
      data: { code: "FIELD_REQUIRED", message: text },
    });
  }

  expect(
    await launch(
      ["ana@example.com", "ben@example.com"],
      " See you Wednesday. ",
    ),
  ).toEqual({ invited: 2, emailed: 2, links: [] });
  const roleId = await employeeRoleId(t, orgId);
  const sprint = await sprintOf(t, orgId);
  const invites = await invitesOf(t, orgId);
  expect(invites.map((i) => i.email)).toEqual([
    "ana@example.com",
    "ben@example.com",
  ]);
  for (const invite of invites) {
    expect(invite).toMatchObject({
      status: "pending",
      roleId,
      sprintId: sprint?._id,
      message: "See you Wednesday.",
      invitedBy: "user_owner",
    });
    expect(invite.sentAt).toEqual(expect.any(Number));
  }
  // Launch stores week one as of launch, whatever the draft held.
  expect(sprint).toMatchObject({
    startDate: weekOneDate(3, sprint!.launchedAt!, "Australia/Melbourne"),
    inviteMessage: "See you Wednesday.",
  });
  expect(sprint?.launchedAt).toEqual(expect.any(Number));
  expect(await launchedEvents(t, orgId)).toHaveLength(1);
});

test("neither setup nor launch writes a sprint status (Ruling 11)", async () => {
  const { t, owner, orgId, launch } = await manager();
  // A real workspace's first commit makes the draft (`ensureSprint`).
  await owner.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  await finishPathway(t, orgId);
  await saveAgreement(t, orgId);
  expect((await sprintOf(t, orgId))?.status).toBeUndefined();
  await launch(["ana@example.com"]);
  const sprint = await sprintOf(t, orgId);
  expect(sprint?.launchedAt).toEqual(expect.any(Number));
  expect(sprint?.status).toBeUndefined();
  // Launch stores next week's hour, so the sprint is scheduled until its Monday.
  expect((await owner.query(api.sprints.current, {}))?.phase).toBe("scheduled");
});

test("launch lowercases, dedupes and skips members", async () => {
  const { t, owner, orgId, launch } = await manager();
  await ready(t, orgId);
  await seat(t, orgId, "user_bob", []); // user_bob@example.com is a member
  const roleId = await employeeRoleId(t, orgId);
  await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: "dee@example.com",
  });

  const result = await launch([
    " Ana@Example.com ",
    "ana@example.com",
    "USER_BOB@example.com",
    "Dee@example.com",
    "cy@example.com",
    "",
  ]);
  expect(result.invited).toBe(2);
  expect(result.emailed).toBe(0);
  expect(result.links.map((l) => l.email)).toEqual([
    "ana@example.com",
    "cy@example.com",
  ]);
  expect((await invitesOf(t, orgId)).map((i) => i.email).sort()).toEqual([
    "ana@example.com",
    "cy@example.com",
    "dee@example.com",
  ]);
});

test("launch refuses once the sprint has launched", async () => {
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);
  await launch(["ana@example.com"]);
  await expect(launch(["ben@example.com"])).rejects.toMatchObject({
    data: {
      code: "SPRINT_LAUNCHED",
      message: "Your sprint has already launched.",
    },
  });
  expect(await invitesOf(t, orgId)).toHaveLength(1);
  expect(await launchedEvents(t, orgId)).toHaveLength(1);
});

test("launch moves week one forward when its hour has passed", async () => {
  const { t, orgId, as } = await calderLane();
  await ready(t, orgId);
  // Thursday 10 September: week one's hour (Wednesday the 9th) has gone.
  await t.run((ctx) =>
    ctx.db.patch(orgId, { demoNow: mel("2026-09-10T09:00") }),
  );
  await as("priya").mutation(api.sprints.launch, {
    emails: ["dan.okafor@calderlane.com.au"],
    message: "",
    expectOrgId: orgId,
  });
  expect(await sprintOf(t, orgId)).toMatchObject({
    startDate: "2026-09-16",
    launchedAt: mel("2026-09-10T09:00"),
  });
});

test("a draft revisited six days on names one week one everywhere", async () => {
  const { t, orgId, as } = await calderLane();
  const priya = as("priya");
  // Tuesday 1 September: week one is Wednesday the 9th.
  await priya.mutation(api.sprints.commit, {
    weekday: 3,
    start: "14:00",
    expectOrgId: orgId,
  });
  await finishPathway(t, orgId);
  await saveAgreement(t, orgId);
  // Monday 7 September: the 9th is this week now, so week one is the 16th.
  await t.run((ctx) =>
    ctx.db.patch(orgId, { demoNow: mel("2026-09-07T09:30") }),
  );
  expect(await priya.query(api.sprints.current, {})).toMatchObject({
    startDate: "2026-09-16",
    weekOneMonday: "2026-09-14",
  });
  expect(
    (await priya.query(api.sprints.launchPage, {}))?.summary,
  ).toMatchObject({
    runs: "16 September to 7 October 2026",
    showAndTell: "Show and tell, 7 October",
  });
  expect((await priya.query(api.viewer.shell, {}))?.status).toMatchObject({
    label: "Sprint starts",
    value: "Wed 16 Sep, 2:00 PM",
  });
  await priya.mutation(api.sprints.launch, {
    emails: ["dan.okafor@calderlane.com.au"],
    message: "",
    expectOrgId: orgId,
  });
  expect((await sprintOf(t, orgId))?.startDate).toBe("2026-09-16");
});

test("an address launched with capitals and a dot joins as an Employee", async () => {
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);
  const { links } = await launch(["Ana@Example.com."]);
  expect(links.map((l) => l.email)).toEqual(["ana@example.com"]);
  const ana = await seedAuthUser(t, {
    name: "Ana",
    email: "ana@example.com",
    emailVerified: true,
  });
  await t.withIdentity(ana).mutation(api.invites.accept, {
    token: links[0]!.token,
  });

  const roleId = await employeeRoleId(t, orgId);
  const sprint = await sprintOf(t, orgId);
  const seatOf = await t.run(async (ctx) =>
    (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).find((p) => p.userId === ana.subject),
  );
  expect(seatOf).toMatchObject({ roleId, email: "ana@example.com" });
  const events = await t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  expect(
    events.filter((e) => e.type === "invite.accepted").map((e) => e.sprintId),
  ).toEqual([sprint!._id]);
});

test("the demo workspace never sends and returns every link", async () => {
  emailOn();
  const { t, orgId, as } = await calderLane();
  await ready(t, orgId);
  const priya = as("priya");
  const result = await priya.mutation(api.sprints.launch, {
    // Priya is already a member. A real address in the demo still isn't mailed.
    emails: [...CAST, "priya.raman@calderlane.com.au", "friend@example.com"],
    message: "See you Wednesday.",
    expectOrgId: orgId,
  });
  expect(result.invited).toBe(9);
  expect(result.emailed).toBe(0);
  expect(result.links.map((l) => l.email)).toEqual([
    ...CAST,
    "friend@example.com",
  ]);
  expect((await invitesOf(t, orgId)).every((i) => i.sentAt === undefined)).toBe(
    true,
  );
  expect((await priya.query(api.sprints.launchPage, {}))?.links).toHaveLength(
    9,
  );
  // Launched on time: week one stays where 04 put it.
  expect(await sprintOf(t, orgId)).toMatchObject({
    startDate: "2026-09-09",
    inviteMessage: "See you Wednesday.",
  });
  // The members tab doesn't send from the demo either.
  const roleId = await employeeRoleId(t, orgId);
  expect(
    await priya.mutation(api.invites.create, {
      orgId,
      roleId,
      email: "pal@example.com",
    }),
  ).toMatchObject({ emailed: false });
});

test("email sends count against inviteEmail and stop at 50", async () => {
  emailOn();
  const { t, owner, orgId, launch } = await manager();
  await ready(t, orgId);
  const emails = Array.from({ length: 50 }, (_, i) => `mate${i}@example.com`);
  expect(await launch(emails)).toMatchObject({
    invited: 50,
    emailed: 50,
    links: [],
  });

  const roleId = await employeeRoleId(t, orgId);
  // The 51st real email this hour is refused, and its invitation with it.
  await expect(
    owner.mutation(api.invites.create, {
      orgId,
      roleId,
      email: "late@example.com",
    }),
  ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } });
  // A link sends nothing, so it still works.
  expect(
    await owner.mutation(api.invites.create, { orgId, roleId }),
  ).toMatchObject({ emailed: false });
  expect(await invitesOf(t, orgId)).toHaveLength(51);
});

test("an employee can't launch", async () => {
  const { t, orgId } = await manager();
  await ready(t, orgId);
  await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    await ctx.db.insert("people", {
      orgId,
      roleId: roles.find((r) => r.name === "Employee")!._id,
      ...personFields("user_emp"),
    });
  });
  const emp = t.withIdentity({ subject: "user_emp" });
  await expect(
    emp.mutation(api.sprints.launch, {
      emails: ["ana@example.com"],
      message: "",
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  await expect(emp.query(api.sprints.launchPage, {})).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });
  expect(await invitesOf(t, orgId)).toEqual([]);
  expect((await sprintOf(t, orgId))?.launchedAt).toBeUndefined();
});

test("launchPage suggests the cast only in the demo", async () => {
  const { t, orgId, as } = await calderLane();
  const page = await as("priya").query(api.sprints.launchPage, {});
  expect(page).toMatchObject({
    launched: false,
    gate: { committed: false, pathwayDone: false, agreementSaved: false },
    suggested: CAST,
    invited: [],
    links: [],
    summary: {
      hour: "Wednesdays, 2:00 PM to 3:00 PM",
      runs: "9 to 30 September 2026",
      course: "AI Productivity Fundamentals",
      showAndTell: "Show and tell, 30 September",
      agreementSaved: null,
    },
  });
  expect(page?.suggested).toHaveLength(8);
  expect(page?.message).toMatch(/^Hi team, from Wednesday 9 September/);
  await saveAgreement(t, orgId);
  expect(
    (await as("priya").query(api.sprints.launchPage, {}))?.summary
      .agreementSaved,
  ).toBe("Saved 7 September");

  const { t: real, owner, orgId: realOrg } = await manager();
  expect(await owner.query(api.sprints.launchPage, {})).toBeNull(); // no sprint yet
  await commitHour(real, realOrg);
  expect(await owner.query(api.sprints.launchPage, {})).toMatchObject({
    suggested: [],
    message: "",
  });
});

test("links need members:manage", async () => {
  const { t, owner, orgId, launch } = await manager();
  await ready(t, orgId);
  const { as: lead } = await seat(t, orgId, "user_lead", ["sprint:manage"]);
  await expect(
    lead.mutation(api.sprints.launch, {
      emails: ["ana@example.com"],
      message: "",
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });

  const { links } = await launch(["ana@example.com"]);
  const [invite] = await invitesOf(t, orgId);
  expect(links).toEqual([{ email: "ana@example.com", token: invite?.token }]);
  expect((await owner.query(api.sprints.launchPage, {}))?.links).toEqual(links);
  expect((await lead.query(api.sprints.launchPage, {}))?.links).toBeNull();
  // 07 says why the lead can't send, instead of a button that is refused.
  expect((await lead.query(api.sprints.launchPage, {}))?.canInvite).toBe(false);
  expect((await owner.query(api.sprints.launchPage, {}))?.canInvite).toBe(true);
  expect((await lead.query(api.sprints.launchPage, {}))?.invited).toEqual([
    { email: "ana@example.com", status: "pending" },
  ]);
  // With email on, the page hands out no links: the invitations were mailed.
  vi.stubEnv("RESEND_FROM", "Lead the Way <hello@example.com>");
  expect((await owner.query(api.sprints.launchPage, {}))?.links).toBeNull();
});

test("launchPage lists an address once, as its newest invitation", async () => {
  const { t, owner, orgId, launch } = await manager();
  await ready(t, orgId);
  await launch(["ana@example.com", "ben@example.com"]);
  const [first] = await invitesOf(t, orgId);
  // Ana's was withdrawn and sent again for the same sprint.
  await t.run(async (ctx) => {
    await ctx.db.patch(first!._id, { status: "revoked" });
    const { orgId, roleId, email, sprintId, invitedBy, expiresAt } = first!;
    await ctx.db.insert("orgInvites", {
      ...{ orgId, roleId, email, sprintId, invitedBy, expiresAt },
      token: "again",
      status: "pending",
      createdAt: Date.now(),
    });
  });
  const invited = (await owner.query(api.sprints.launchPage, {}))?.invited;
  expect(invited).toHaveLength(2);
  expect(invited).toEqual(
    expect.arrayContaining([
      { email: "ana@example.com", status: "pending" },
      { email: "ben@example.com", status: "pending" },
    ]),
  );
});

test("the Sprint nav points to /manager after launch", async () => {
  const { t, owner, orgId, launch } = await manager();
  await ready(t, orgId);
  const sprintLink = async () =>
    (await owner.query(api.viewer.shell, {}))?.nav[0]?.links.find(
      (l) => l.label === "Sprint",
    )?.href;
  expect(await sprintLink()).toBe("/manager/sprint/launch");
  await launch(["ana@example.com"]);
  expect(await sprintLink()).toBe("/manager");
});

test("a jump after a product launch adds only the missing cast", async () => {
  const { t, orgId, as } = await calderLane();
  await ready(t, orgId);
  await as("priya").mutation(api.sprints.launch, {
    emails: CAST.slice(0, 3),
    message: "",
    expectOrgId: orgId,
  });
  await t.mutation(internal.seed.clock, { target: "week1" });
  const emails = (await invitesOf(t, orgId)).map((i) => i.email);
  expect(emails).toHaveLength(8);
  expect(new Set(emails).size).toBe(8);
  expect(await launchedEvents(t, orgId)).toHaveLength(1);
});

test("at week one only Omar's invitation is still open", async () => {
  // Task 13 copies a pending link at `week1`. Seven of the cast have joined
  // by then, so Omar's is the only link the page hands out.
  const { t, as } = await calderLane();
  await t.mutation(internal.seed.clock, { target: "week1" });
  const page = await as("priya").query(api.sprints.launchPage, {});
  expect(page?.links?.map((l) => l.email)).toEqual([
    "omar.haddad@calderlane.com.au",
  ]);
});

test("launch never invites into a role that grants anything", async () => {
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);
  const employee = await employeeRoleId(t, orgId);
  // "Employee" widened to manage members is no longer a safe default.
  await t.run((ctx) =>
    ctx.db.patch(employee, { permissions: ["members:manage"] }),
  );
  const noRole = {
    data: {
      code: "NOT_FOUND",
      message:
        "There is no role to invite your team into. Add one in workspace settings first.",
    },
  };
  await expect(launch(["ana@example.com"])).rejects.toMatchObject(noRole);
  // Nor is the only other custom role, however narrow it looks.
  await seat(t, orgId, "user_lead", ["sprint:manage"]);
  await expect(launch(["ana@example.com"])).rejects.toMatchObject(noRole);
  expect(await invitesOf(t, orgId)).toEqual([]);
  expect((await sprintOf(t, orgId))?.launchedAt).toBeUndefined();

  // A role that grants nothing, whatever it is called, is used.
  const learner = await t.run((ctx) =>
    ctx.db.insert("orgRoles", {
      orgId,
      kind: "custom",
      name: "Learner",
      permissions: [],
      createdAt: 1,
    }),
  );
  await launch(["ana@example.com"]);
  expect((await invitesOf(t, orgId)).map((i) => i.roleId)).toEqual([learner]);
});

/** A pending invitation to `email`, open until `expiresAt` (real time). */
async function pendingInvite(
  t: T,
  orgId: Id<"orgs">,
  email: string,
  expiresAt: number,
) {
  const roleId = await employeeRoleId(t, orgId);
  await t.run((ctx) =>
    ctx.db.insert("orgInvites", {
      orgId,
      roleId,
      token: `tok-${email}`,
      email,
      status: "pending",
      invitedBy: "user_owner",
      expiresAt,
      createdAt: 1,
    }),
  );
}

test("a lapsed invitation doesn't block its address at launch", async () => {
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);
  await pendingInvite(t, orgId, "ana@example.com", Date.now() - 1);
  expect(await launch(["ana@example.com"])).toMatchObject({ invited: 1 });
  expect(
    (await invitesOf(t, orgId)).filter((i) => i.email === "ana@example.com"),
  ).toHaveLength(2);
});

test("launch holds the open-invitation cap", async () => {
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);
  for (let i = 0; i < 99; i++) {
    await pendingInvite(t, orgId, `open${i}@example.com`, Date.now() + 60_000);
  }
  // A lapsed one doesn't count toward the cap.
  await pendingInvite(t, orgId, "gone@example.com", Date.now() - 1);
  await expect(
    launch(["ana@example.com", "ben@example.com"]),
  ).rejects.toMatchObject({
    data: {
      code: "FIELD_REQUIRED",
      message: "There are too many invitations open. Revoke some first.",
    },
  });
  expect(await invitesOf(t, orgId)).toHaveLength(100);
  expect((await sprintOf(t, orgId))?.launchedAt).toBeUndefined();
  // An address already open doesn't count twice: 99 open plus one new is 100.
  expect(await launch(["open0@example.com", "ana@example.com"])).toMatchObject({
    invited: 1,
  });
});

test("launch refuses address punctuation and a trailing dot", async () => {
  emailOn();
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);
  for (const bad of [
    '"ana"@example.com',
    "<ana@example.com>",
    "ana(x)@example.com",
    "ana,ben@example.com",
    "ana;ben@example.com",
    "ana:ben@example.com",
    "ana[1]@example.com",
    "ana\\ben@example.com",
    "ana@example..",
  ]) {
    await expect(launch([bad]), bad).rejects.toMatchObject({
      data: {
        code: "FIELD_REQUIRED",
        message: "Check the email addresses and try again.",
      },
    });
  }
  expect(isDemoAddress("dan.okafor@calderlane.com.au.")).toBe(true);
  // A trailing dot is dropped, so a demo address can't dodge the demo check.
  expect(await launch(["Dan.Okafor@CalderLane.com.au."])).toEqual({
    invited: 1,
    emailed: 0,
    links: [
      { email: "dan.okafor@calderlane.com.au", token: expect.any(String) },
    ],
  });
  expect((await invitesOf(t, orgId)).map((i) => i.email)).toEqual([
    "dan.okafor@calderlane.com.au",
  ]);
});

test("a launch that runs out of inviteEmail tokens writes nothing", async () => {
  emailOn();
  const { t, orgId, launch } = await manager();
  await ready(t, orgId);
  // 49 of this hour's 50 real emails already spent.
  await t.run((ctx) =>
    rateLimiter.limit(ctx, "inviteEmail", { key: "user_owner", count: 49 }),
  );
  await expect(
    launch(["ana@example.com", "ben@example.com"]),
  ).rejects.toMatchObject({
    data: { code: "RATE_LIMITED", name: "inviteEmail" },
  });
  expect((await sprintOf(t, orgId))?.launchedAt).toBeUndefined();
  expect(await invitesOf(t, orgId)).toEqual([]);
  expect(await launchedEvents(t, orgId)).toEqual([]);
});

test("an address is compared normalised on both sides at launch (Ruling 4)", async () => {
  const { t, owner, orgId, launch } = await manager();
  await ready(t, orgId);
  const roleId = await employeeRoleId(t, orgId);
  await owner.mutation(api.invites.create, {
    orgId,
    roleId,
    email: " Omar@Example.com. ",
  });
  // A row stored before Ruling 4, with its trailing dot.
  await pendingInvite(t, orgId, "ben@example.com.", Date.now() + 60_000);
  expect(
    await launch(["omar@example.com", "Ben@Example.com", "ana@example.com"]),
  ).toMatchObject({ invited: 1 });
  expect((await invitesOf(t, orgId)).map((i) => i.email).sort()).toEqual([
    "ana@example.com",
    "ben@example.com.",
    "omar@example.com",
  ]);
});
