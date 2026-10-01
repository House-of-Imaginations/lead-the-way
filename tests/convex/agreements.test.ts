import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  CHECK_LABELS,
  DEFAULT_CHECKS,
  DEFAULT_ESCALATION,
  NEVER_IN_DEFAULTS,
} from "../../convex/lib/agreement";
import { mel } from "../../convex/lib/demo/schedule";
import { personFields } from "./testHelpers";
import {
  calderLane,
  harness,
  seat,
  workspace,
  type T,
} from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

type Contact =
  { kind: "person"; personId: Id<"people"> } | { kind: "label"; label: string };

const PRIVACY: Contact = { kind: "label", label: "Privacy officer" };
const PRIYA = "priya.raman@calderlane.com.au";

/** What 06 saves by default, with the tools the demo uses. */
const content = (contact: Contact) => ({
  tools: ["Microsoft Copilot", "ChatGPT Enterprise"],
  neverIn: NEVER_IN_DEFAULTS.map((t) => ({ ...t })),
  checks: DEFAULT_CHECKS.map((t) => ({ ...t })),
  escalation: DEFAULT_ESCALATION,
  contact,
});

/** A fresh workspace and a save as its owner. */
async function manager() {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const save = (c: ReturnType<typeof content>) =>
    owner.mutation(api.agreements.save, { ...c, expectOrgId: orgId });
  return { t, owner, orgId, save };
}

async function employee(t: T, orgId: Id<"orgs">) {
  await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const role = roles.find((r) => r.name === "Employee")!;
    await ctx.db.insert("people", {
      orgId,
      roleId: role._id,
      ...personFields("user_emp"),
    });
  });
  return t.withIdentity({ subject: "user_emp" });
}

async function personIdOf(
  t: T,
  orgId: Id<"orgs">,
  match: (p: { email: string; userId: string }) => boolean,
) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find(match)!._id;
  });
}

async function versionsOf(t: T, orgId: Id<"orgs">) {
  return await t.run((ctx) =>
    ctx.db
      .query("agreements")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
}

async function savedEvents(t: T, orgId: Id<"orgs">) {
  const events = await t.run((ctx) =>
    ctx.db
      .query("events")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
  );
  return events.filter((e) => e.type === "agreement.saved").map((e) => e.meta);
}

test("An employee can't save the agreement", async () => {
  const t = harness();
  const { orgId } = await workspace(t);
  const emp = await employee(t, orgId);
  await expect(
    emp.mutation(api.agreements.save, {
      ...content(PRIVACY),
      expectOrgId: orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  await expect(emp.query(api.agreements.current, {})).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });
  expect(await versionsOf(t, orgId)).toEqual([]);
});

test("the first save makes version 1", async () => {
  const { t, orgId, as } = await calderLane();
  // Monday 7 September, 11:00 AM in Melbourne, as on 06.
  await t.run((ctx) =>
    ctx.db.patch(orgId, { demoNow: mel("2026-09-07T11:00") }),
  );
  const priyaId = await personIdOf(t, orgId, (p) => p.email === PRIYA);
  const priya = as("priya");
  const input = content({ kind: "person", personId: priyaId });

  expect(
    await priya.mutation(api.agreements.save, {
      ...input,
      expectOrgId: orgId,
    }),
  ).toEqual({ version: 1, changed: true });
  expect(await priya.query(api.agreements.current, {})).toEqual({
    status: "saved",
    version: 1,
    savedOn: "7 September",
    ...input,
    contactPerson: { id: priyaId, name: "Priya Raman" },
    contactOptions: [
      { value: priyaId, label: "Priya Raman" },
      { value: "#ai-questions channel", label: "#ai-questions channel" },
      { value: "Privacy officer", label: "Privacy officer" },
    ],
    teamName: "Client Services team",
    dateLabel: "7 September 2026",
    // A draft sprint's week one is live: from Monday the 7th it is the 16th,
    // so the last week's hour is 7 October (Ruling 17).
    reviewDate: "7 October 2026",
    managerInitials: "PR",
  });
  const [v1] = await versionsOf(t, orgId);
  expect(v1).toMatchObject({
    version: 1,
    status: "saved",
    savedAt: mel("2026-09-07T11:00"),
    savedBy: priyaId,
  });
  expect(await savedEvents(t, orgId)).toEqual([{ version: 1 }]);
});

test("saving the same content changes nothing", async () => {
  const { t, orgId, save } = await manager();
  await save(content(PRIVACY));
  expect(await save(content(PRIVACY))).toEqual({ version: 1, changed: false });
  // The same words with stray spaces are the same content.
  expect(
    await save({
      ...content(PRIVACY),
      tools: [" Microsoft Copilot ", "ChatGPT Enterprise"],
    }),
  ).toEqual({ version: 1, changed: false });
  expect(await versionsOf(t, orgId)).toHaveLength(1);
  expect(await savedEvents(t, orgId)).toEqual([{ version: 1 }]);
});

test("a changed save makes the next version", async () => {
  const { t, owner, orgId, save } = await manager();
  await save(content(PRIVACY));
  expect(
    await save({ ...content(PRIVACY), tools: ["Microsoft Copilot"] }),
  ).toEqual({ version: 2, changed: true });

  const versions = await versionsOf(t, orgId);
  expect(versions.map((a) => [a.version, a.status, a.tools])).toEqual([
    [1, "saved", ["Microsoft Copilot", "ChatGPT Enterprise"]],
    [2, "saved", ["Microsoft Copilot"]],
  ]);
  expect(await savedEvents(t, orgId)).toEqual([{ version: 1 }, { version: 2 }]);
  expect(await owner.query(api.agreements.current, {})).toMatchObject({
    status: "saved",
    version: 2,
    tools: ["Microsoft Copilot"],
  });
});

test("a draft latest version is saved in place", async () => {
  const { t, owner, orgId, save } = await manager();
  const me = await personIdOf(t, orgId, (p) => p.userId === "user_owner");
  await t.run(async (ctx) => {
    const team = (await ctx.db
      .query("teams")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique())!;
    const base = { orgId, teamId: team._id, ...content(PRIVACY) };
    await ctx.db.insert("agreements", {
      ...base,
      version: 1,
      status: "saved",
      savedAt: 1,
    });
    await ctx.db.insert("agreements", {
      ...base,
      version: 2,
      status: "draft",
      escalation: "",
    });
  });
  expect((await owner.query(api.agreements.current, {})).status).toBe("draft");

  expect(await save(content(PRIVACY))).toEqual({ version: 2, changed: true });
  const versions = await versionsOf(t, orgId);
  expect(versions).toHaveLength(2);
  expect(versions[1]).toMatchObject({
    version: 2,
    status: "saved",
    escalation: DEFAULT_ESCALATION,
    savedBy: me,
  });
  expect(await savedEvents(t, orgId)).toEqual([{ version: 2 }]);
});

test("save trims, caps and refuses empty labels", async () => {
  const { t, orgId, save } = await manager();
  expect(
    await save({
      ...content(PRIVACY),
      tools: ["  Copilot ", "copilot", "Claude"],
      neverIn: [
        { label: " Passwords ", on: true },
        { label: "passwords", on: false },
      ],
      escalation: "  Ask Priya first.  ",
    }),
  ).toEqual({ version: 1, changed: true });
  const [v1] = await versionsOf(t, orgId);
  expect(v1).toMatchObject({
    tools: ["Copilot", "Claude"],
    neverIn: [{ label: "Passwords", on: true }],
    escalation: "Ask Priya first.",
  });

  const refused = [
    { tools: ["   "] },
    { tools: ["x".repeat(61)] },
    { tools: Array.from({ length: 11 }, (_, i) => `Tool ${i}`) },
    { neverIn: [{ label: "", on: true }] },
    {
      neverIn: Array.from({ length: 13 }, (_, i) => ({
        label: `Item ${i}`,
        on: true,
      })),
    },
    {
      checks: CHECK_LABELS.map((label, i) => ({
        label: i === 0 ? "Trust the output" : label,
        on: true,
      })),
    },
    { checks: [] },
    { escalation: "x".repeat(501) },
    { contact: { kind: "label" as const, label: "My cousin" } },
  ];
  for (const change of refused) {
    await expect(
      save({ ...content(PRIVACY), ...change }),
      JSON.stringify(change).slice(0, 60),
    ).rejects.toMatchObject({ data: { code: "FIELD_REQUIRED" } });
  }
  expect(await versionsOf(t, orgId)).toHaveLength(1);
});

test("a contact from another workspace is refused", async () => {
  const t = harness();
  const a = await workspace(t, "Aster Network");
  const { personId } = await seat(t, a.orgId, "user_bob", []);
  // The owner's newest workspace is the open one.
  const b = await workspace(t, "Birch Studio");
  await expect(
    b.owner.mutation(api.agreements.save, {
      ...content({ kind: "person", personId }),
      expectOrgId: b.orgId,
    }),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  expect(await versionsOf(t, b.orgId)).toEqual([]);
});

test("current names a saved contact who isn't the viewer", async () => {
  const { t, owner, orgId, save } = await manager();
  const { as: lead, personId: leadId } = await seat(t, orgId, "user_lead", [
    "sprint:manage",
  ]);
  const me = await personIdOf(t, orgId, (p) => p.userId === "user_owner");
  await save(content({ kind: "person", personId: leadId }));
  const page = await owner.query(api.agreements.current, {});
  expect(page.contact).toEqual({ kind: "person", personId: leadId });
  expect(page.contactPerson).toEqual({ id: leadId, name: "user_lead" });
  // The viewer is still offered first.
  expect(page.contactOptions[0]).toEqual({
    value: me,
    label: expect.any(String),
  });
  expect((await lead.query(api.agreements.current, {})).contactPerson).toEqual({
    id: leadId,
    name: "user_lead",
  });
  // A contact who has since left reads as none; the page falls back to the viewer.
  await t.run((ctx) => ctx.db.delete(leadId));
  expect((await owner.query(api.agreements.current, {})).contactPerson).toBe(
    null,
  );
  await save(content(PRIVACY));
  expect((await owner.query(api.agreements.current, {})).contactPerson).toBe(
    null,
  );
});

test("current returns the defaults before any save", async () => {
  const { t, owner, orgId } = await manager();
  const me = await personIdOf(t, orgId, (p) => p.userId === "user_owner");
  const page = await owner.query(api.agreements.current, {});
  expect(page).toMatchObject({
    status: "none",
    version: null,
    savedOn: null,
    tools: [],
    neverIn: NEVER_IN_DEFAULTS,
    checks: DEFAULT_CHECKS,
    escalation: DEFAULT_ESCALATION,
    contact: { kind: "person", personId: me },
    teamName: "Your team",
    // No sprint yet, so there is no hour to review at.
    reviewDate: "",
  });
  expect(page.contactOptions.map((o) => o.value)).toEqual([
    me,
    "#ai-questions channel",
    "Privacy officer",
  ]);
  expect(page.dateLabel).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
  // The words on 06.
  expect(NEVER_IN_DEFAULTS).toEqual(
    [
      "Client names",
      "Personal information",
      "Passwords",
      "Confidential commercial information",
      "Unapproved customer data",
    ].map((label) => ({ label, on: true })),
  );
  expect(DEFAULT_CHECKS.map((c) => c.on)).toEqual([
    true,
    true,
    true,
    true,
    false,
    false,
  ]);
});

test("the checklist marks the agreement done", async () => {
  const { owner, save } = await manager();
  const state = async () =>
    (await owner.query(api.viewer.shell, {}))?.checklist?.items[3];
  expect(await state()).toMatchObject({
    label: "Team agreement",
    state: "todo",
  });
  await save(content(PRIVACY));
  expect(await state()).toMatchObject({
    label: "Team agreement",
    state: "done",
  });
});

test("a jump after the tester saved leaves one saved version", async () => {
  const { t, orgId, as } = await calderLane();
  const priyaId = await personIdOf(t, orgId, (p) => p.email === PRIYA);
  await as("priya").mutation(api.agreements.save, {
    ...content({ kind: "person", personId: priyaId }),
    tools: ["Claude"],
    expectOrgId: orgId,
  });
  await t.mutation(internal.seed.clock, { target: "week1" });
  const versions = await versionsOf(t, orgId);
  expect(versions.map((a) => [a.version, a.status, a.tools])).toEqual([
    [1, "saved", ["Claude"]],
  ]);
  expect(await savedEvents(t, orgId)).toEqual([{ version: 1 }]);
});
