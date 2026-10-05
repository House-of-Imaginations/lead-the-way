import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  CHECK_LABELS,
  DEFAULT_CHECKS,
  DEFAULT_ESCALATION,
  NEVER_IN_DEFAULTS,
} from "../../convex/lib/agreement";
import { DEMO_TARGETS, mel } from "../../convex/lib/demo/schedule";
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

async function eventsOf(t: T, orgId: Id<"orgs">, type: string) {
  return await t.run(async (ctx) =>
    (
      await ctx.db
        .query("events")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
    ).filter((e) => e.type === type),
  );
}

const DAN = "dan.okafor@calderlane.com.au";

/** Calder Lane at week 1: v1 saved on 7 September, 7 signed, Dan not yet. */
async function week1() {
  const lane = await calderLane();
  await lane.t.mutation(internal.seed.clock, { target: "week1" });
  return lane;
}

async function danSignatures(t: T, orgId: Id<"orgs">) {
  const dan = await personIdOf(t, orgId, (p) => p.email === DAN);
  return await t.run(async (ctx) =>
    (await ctx.db.query("agreementSignatures").collect()).filter(
      (s) => s.personId === dan,
    ),
  );
}

test("forMe shows Dan the saved agreement and a count, never who signed", async () => {
  const { as } = await week1();
  const forMe = await as("dan").query(api.agreements.forMe, {});
  expect(forMe).toEqual({
    heading: "Client Services team, agreed 7 September 2026",
    version: 1,
    tools: "Microsoft Copilot, ChatGPT Enterprise. Anything else, ask first.",
    toolList: ["Microsoft Copilot", "ChatGPT Enterprise"],
    neverIn: [
      "Client names",
      "Personal information",
      "Passwords",
      "Confidential commercial information",
      "Unapproved customer data",
    ],
    practise: "Practise with de-identified or sample data.",
    checks: [
      "Verify factual claims",
      "Check sources or citations",
      "Human review before client delivery",
      "Review tone and context",
    ],
    escalation: DEFAULT_ESCALATION,
    contact: "Ask Priya Raman.",
    contactName: "Priya Raman",
    // Over the seated team without Priya (team:insights), as the overview
    // counts it: the six who signed at 9:00 AM, of seven, Dan not yet.
    signatures: { signed: 6, of: 7 },
    mine: "unsigned",
    initials: "DO",
  });
  // Ruling 1: nobody else's name or initials.
  expect(JSON.stringify(forMe)).not.toMatch(/Whitlock|Tanaka|"SW"|"MT"/);
});

test("Priya and any team:insights holder never get the count", async () => {
  // Calder Lane is over the threshold; the role alone withholds it, so
  // forMe can't bypass the overview (manager Ruling 15).
  const { t, orgId, as } = await week1();
  expect(await as("priya").query(api.agreements.forMe, {})).toMatchObject({
    version: 1,
    mine: "signed",
    initials: "PR",
    signatures: null,
  });
  const { as: lead } = await seat(t, orgId, "user_lead", ["team:insights"]);
  expect(await lead.query(api.agreements.forMe, {})).toMatchObject({
    mine: "unsigned",
    signatures: null,
  });
});

test("Dan signs once, and the script never signs again for him", async () => {
  const { t, orgId, as } = await week1();
  const dan = as("dan");
  await dan.mutation(api.agreements.sign, { version: 1, expectOrgId: orgId });
  // A double tap changes nothing.
  await dan.mutation(api.agreements.sign, { version: 1, expectOrgId: orgId });
  expect(await dan.query(api.agreements.forMe, {})).toMatchObject({
    mine: "signed",
    signatures: { signed: 7, of: 7 },
  });
  expect(await danSignatures(t, orgId)).toHaveLength(1);
  expect(
    (await eventsOf(t, orgId, "agreement.signed")).filter(
      (e) => e.at === DEMO_TARGETS.week1,
    ),
  ).toEqual([expect.objectContaining({ meta: { version: 1 } })]);

  // The script's late signing (1:45 PM) finds his row and leaves it.
  await t.mutation(internal.seed.clock, { target: "week2" });
  expect(await danSignatures(t, orgId)).toHaveLength(1);
});

test("a new version asks Dan to sign again, and its count starts at nobody", async () => {
  const { t, orgId, as } = await week1();
  const dan = as("dan");
  await dan.mutation(api.agreements.sign, { version: 1, expectOrgId: orgId });

  const priya = await personIdOf(t, orgId, (p) => p.email === PRIYA);
  const { version } = await as("priya").mutation(api.agreements.save, {
    ...content({ kind: "person", personId: priya }),
    tools: ["Microsoft Copilot"],
    expectOrgId: orgId,
  });
  expect(version).toBe(2);

  expect(await dan.query(api.agreements.forMe, {})).toMatchObject({
    version: 2,
    tools: "Microsoft Copilot. Anything else, ask first.",
    mine: "updated",
    signatures: { signed: 0, of: 7 },
  });
  await expect(
    dan.mutation(api.agreements.sign, { version: 1, expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "AGREEMENT_CHANGED" } });
  await dan.mutation(api.agreements.sign, { version: 2, expectOrgId: orgId });
  expect(await dan.query(api.agreements.forMe, {})).toMatchObject({
    mine: "signed",
    signatures: { signed: 1, of: 7 },
  });
});

test("nothing saved, nothing to sign; a team under the threshold gets no count", async () => {
  const { t, orgId, save } = await manager();
  const emp = await employee(t, orgId);
  expect(await emp.query(api.agreements.forMe, {})).toBeNull();
  await expect(
    emp.mutation(api.agreements.sign, { version: 1, expectOrgId: orgId }),
  ).rejects.toMatchObject({ data: { code: "AGREEMENT_NOT_SAVED" } });

  await save(content(PRIVACY));
  await emp.mutation(api.agreements.sign, { version: 1, expectOrgId: orgId });
  // One seated employee, under 5: "1 of 1" would name who signed.
  expect(await emp.query(api.agreements.forMe, {})).toMatchObject({
    version: 1,
    contact: "Ask Privacy officer.",
    signatures: null,
    mine: "signed",
  });
});
