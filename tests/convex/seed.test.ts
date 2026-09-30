import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, components, internal } from "../../convex/_generated/api";
import {
  ACCOUNT_HOLDERS,
  demoUserId,
  isDemoAddress,
} from "../../convex/lib/demo/cast";
import { DEMO_NOW, SCHEDULE } from "../../convex/lib/demo/schedule";
import { sendEmail, type EmailCtx } from "../../convex/lib/email/send";
import { personFields, seedAuthUser, seedDemoAccounts } from "./testHelpers";
import { harness, workspace, type T } from "./workspace/helpers";

// convex/auth.ts reads SITE_URL when the module loads, and convex-test loads
// it lazily on the first action that reaches it. Nothing here imports it
// statically, so these stubs land before it is first evaluated.
beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
  vi.stubEnv("DEMO_PASSWORD", "correct horse battery");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("BETTER_AUTH_SECRET", "a test secret at least 32 characters long");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test("the demo accounts need demo mode and a long password", async () => {
  const t = harness();
  vi.stubEnv("DEMO_PASSWORD", "short");
  await expect(t.action(internal.seed.accounts, {})).rejects.toThrow(
    /DEMO_PASSWORD to at least 12 characters/,
  );
  vi.stubEnv("DEMO_PASSWORD", "");
  await expect(t.action(internal.seed.accounts, {})).rejects.toThrow(
    /DEMO_PASSWORD/,
  );
  vi.stubEnv("DEMO_PASSWORD", "correct horse battery");
  vi.stubEnv("DEMO_MODE", "");
  await expect(t.action(internal.seed.accounts, {})).rejects.toMatchObject({
    data: { code: "FEATURE_UNAVAILABLE" },
  });
});

test("seeding reuses the accounts that exist", async () => {
  const t = harness();
  const seeded = await seedDemoAccounts(t);
  expect(await t.action(internal.seed.accounts, {})).toEqual(seeded);
});

test("a missing demo account is created through sign-up", async () => {
  const t = harness();
  const seeded = await seedDemoAccounts(t, ["grace"]);
  const ids = await t.action(internal.seed.accounts, {});

  expect(ids).toMatchObject(seeded);
  const grace = await t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: "grace.oyelaran@calderlane.com.au" }],
    }),
  );
  expect(grace).toMatchObject({ _id: ids.grace, name: "Grace Oyelaran" });
});

test("demo addresses never get email", async () => {
  expect(isDemoAddress("Dan.Okafor@CalderLane.com.au ")).toBe(true);
  expect(isDemoAddress("dan@example.com")).toBe(false);

  // A configured sender, so the only thing stopping the send is the address.
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "Lead the Way <hello@example.com>");
  await expect(
    sendEmail({} as EmailCtx, "dan.okafor@calderlane.com.au", "Hello", {
      heading: "Hello",
      paragraphs: [],
    }),
  ).resolves.toBe(false);
});

test("writeCalderLane seeds Calder Lane on Tuesday 1 September", async () => {
  const t = harness();
  const accounts = await seedDemoAccounts(t);
  const orgId = await t.mutation(internal.seed.writeCalderLane, { accounts });

  const state = await t.run(async (ctx) => {
    return {
      org: await ctx.db.get(orgId),
      people: await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      roles: await ctx.db
        .query("orgRoles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      team: await ctx.db
        .query("teams")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique(),
      sprint: await ctx.db
        .query("sprints")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique(),
      script: await ctx.db
        .query("demoScript")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
    };
  });

  // 1 Sep 9:30 AM Melbourne (AEST, +10:00).
  expect(DEMO_NOW).toBe(Date.parse("2026-08-31T23:30:00Z"));
  expect(state.org).toMatchObject({
    name: "Calder Lane",
    slug: "calder-lane",
    domain: "calderlane.com.au",
    partnerName: "Southbank Business Collective",
    privacyThreshold: 5,
    isDemo: true,
    demoNow: DEMO_NOW,
  });
  expect(
    state.people.map((p) => [p.name, p.initials, p.jobTitle, p.email]),
  ).toEqual([
    ["Priya Raman", "PR", "Team manager", "priya.raman@calderlane.com.au"],
  ]);
  expect(state.roles.map((r) => [r.kind, r.name])).toEqual([
    ["owner", "Manager"],
    ["custom", "Employee"],
  ]);
  expect(state.team).toMatchObject({
    name: "Client Services team",
    challenges: [],
  });
  expect(state.team?.savedAt).toBeUndefined();
  expect(state.sprint).toMatchObject({
    status: "draft",
    startDate: "2026-09-09",
    timeZone: "Australia/Melbourne",
    weeks: 4,
    protectedHour: { weekday: 3, start: "14:00", durationMinutes: 60 },
    courseTitle: "AI Productivity Fundamentals",
  });
  expect(state.sprint?.committedAt).toBeUndefined();
  expect(state.script.map((row) => row.key)).toEqual(Object.keys(SCHEDULE));
  expect(state.script.every((row) => row.appliedAt === undefined)).toBe(true);

  // Priya opens the demo. Dan isn't in it yet, so he has no workspace.
  const priya = t.withIdentity({ subject: accounts.priya });
  const dan = t.withIdentity({ subject: accounts.dan });
  expect((await priya.query(api.orgs.active, {}))?.org.slug).toBe(
    "calder-lane",
  );
  expect(await dan.query(api.orgs.active, {})).toBeNull();
});

test("reset replaces the demo workspace and nothing else", async () => {
  const t = harness();
  const { orgId: realId } = await workspace(t);
  const accounts = await seedDemoAccounts(t);
  const first = await t.action(internal.seed.reset, {});
  const second = await t.action(internal.seed.reset, {});

  expect(second).not.toBe(first);
  // The accounts survive: the same ids come back.
  expect(await t.action(internal.seed.accounts, {})).toEqual(accounts);
  const state = await t.run(async (ctx) => ({
    first: await ctx.db.get(first),
    names: (await ctx.db.query("orgs").collect()).map((o) => o.name).sort(),
    realPeople: (
      await ctx.db
        .query("people")
        .withIndex("by_org", (q) => q.eq("orgId", realId))
        .collect()
    ).length,
  }));
  expect(state.first).toBeNull();
  expect(state.names).toEqual(["Aster Network", "Calder Lane"]);
  expect(state.realPeople).toBe(1);

  // A real workspace can't take the demo's slug, and the reset won't touch
  // one that somehow has it.
  const other = harness();
  const otherAccounts = await seedDemoAccounts(other);
  await other.run((ctx) =>
    ctx.db.insert("orgs", {
      name: "Not a demo",
      slug: "calder-lane",
      privacyThreshold: 5,
      isDemo: false,
      createdAt: 0,
    }),
  );
  await expect(
    other.mutation(internal.seed.writeCalderLane, {
      accounts: otherAccounts,
    }),
  ).rejects.toThrow(/real workspace/);
});

const SITE = "http://localhost:3000";
const PASSWORD = "correct horse battery";
const LOCKED = "Demo accounts can't be changed. Reset the demo instead.";

/** A browser's POST to Better Auth, through the HTTP routes in convex/http.ts. */
async function post(t: T, path: string, body: object, cookie = "") {
  return await t.fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE, cookie },
    body: JSON.stringify(body),
  });
}
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

test("a demo persona can't change the shared account", async () => {
  const t = harness();
  // Dan through the seed's sign-up, so he has the demo password.
  await seedDemoAccounts(t, ["dan"]);
  await t.action(internal.seed.accounts, {});
  const email = "dan.okafor@calderlane.com.au";
  const signIn = await post(t, "/sign-in/email", { email, password: PASSWORD });
  expect(signIn.status).toBe(200);
  const cookie = cookieOf(signIn);

  const attempts: [string, object][] = [
    [
      "/change-password",
      { currentPassword: PASSWORD, newPassword: "not the demo password" },
    ],
    ["/change-email", { newEmail: "dan@example.com" }],
    ["/update-user", { name: "Not Dan" }],
    ["/delete-user", {}],
    ["/link-social", { provider: "google" }],
    ["/unlink-account", { providerId: "credential" }],
  ];
  for (const [path, body] of attempts) {
    const res = await post(t, path, body, cookie);
    expect(res.status, path).toBe(403);
    expect(await res.json(), path).toMatchObject({ message: LOCKED });
  }
  // Every other tester can still switch to Dan.
  expect(
    (await post(t, "/sign-in/email", { email, password: PASSWORD })).status,
  ).toBe(200);
});

test("a demo persona may use only the allowed auth paths", async () => {
  const t = harness();
  await seedDemoAccounts(t, ["dan"]);
  await t.action(internal.seed.accounts, {});
  const email = "dan.okafor@calderlane.com.au";
  const signIn = await post(t, "/sign-in/email", { email, password: PASSWORD });
  expect(signIn.status).toBe(200);
  const cookie = cookieOf(signIn);

  // Not on the allowlist: one tester can't end every other tester's session.
  for (const path of ["/revoke-other-sessions", "/revoke-sessions"]) {
    const res = await post(t, path, {}, cookie);
    expect(res.status, path).toBe(403);
    expect(await res.json(), path).toMatchObject({ message: LOCKED });
  }
  // On it: reading the session and signing out.
  const session = await t.fetch("/api/auth/get-session", {
    headers: { origin: SITE, cookie },
  });
  expect(session.status).toBe(200);
  expect(await session.json()).toMatchObject({ user: { email } });
  // The token every Convex call from the browser starts with.
  const token = await t.fetch("/api/auth/convex/token", {
    headers: { origin: SITE, cookie },
  });
  expect(token.status).toBe(200);
  expect((await post(t, "/sign-out", {}, cookie)).status).toBe(200);
});

test("only the seed signs up a demo address; real accounts are unaffected", async () => {
  const t = harness();
  const omar = "omar.haddad@calderlane.com.au";
  const res = await post(t, "/sign-up/email", {
    name: "Omar Haddad",
    email: omar,
    password: PASSWORD,
  });
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({
    message: "Demo accounts are made by the seed. Use the persona switch.",
  });
  const user = await t.run((ctx) =>
    ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: omar }],
    }),
  );
  expect(user).toBeNull();

  // A real address signs up and changes its own password as before.
  const bec = await post(t, "/sign-up/email", {
    name: "Bec",
    email: "bec@example.com",
    password: PASSWORD,
  });
  expect(bec.status).toBe(200);
  const changed = await post(
    t,
    "/change-password",
    { currentPassword: PASSWORD, newPassword: "a new long password" },
    cookieOf(bec),
  );
  expect(changed.status).toBe(200);
});

test("nobody signs up a demo address from a browser, demo on or off", async () => {
  const t = harness();
  vi.stubEnv("DEMO_MODE", "");
  const res = await post(t, "/sign-up/email", {
    name: "Omar Haddad",
    email: "omar.haddad@calderlane.com.au",
    password: PASSWORD,
  });
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({
    message: "Demo accounts are made by the seed. Use the persona switch.",
  });
});

test("a demo account stays locked with the demo off", async () => {
  const t = harness();
  await seedDemoAccounts(t, ["dan"]);
  await t.action(internal.seed.accounts, {});
  vi.stubEnv("DEMO_MODE", "");
  const email = "dan.okafor@calderlane.com.au";
  const signIn = await post(t, "/sign-in/email", { email, password: PASSWORD });
  expect(signIn.status).toBe(200);
  const res = await post(
    t,
    "/change-password",
    { currentPassword: PASSWORD, newPassword: "not the demo password" },
    cookieOf(signIn),
  );
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({ message: LOCKED });
});

test("no request makes a demo user or links an account to one; the seed still does", async () => {
  const t = harness();
  const accounts = await seedDemoAccounts(t);
  const bec = await seedAuthUser(t, {
    name: "Bec",
    email: "bec@example.com",
    emailVerified: true,
  });
  // Loaded here, after the env stubs: convex/auth.ts reads SITE_URL on load.
  const { createAuth } = await import("../../convex/auth");
  // What a browser's call carries (a first social sign-in, a link).
  const browser = { request: new Request(SITE) } as never;
  const now = new Date();
  const omar = {
    id: "u1",
    name: "Omar Haddad",
    email: "omar.haddad@calderlane.com.au",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };
  const link = (userId: string) => ({
    id: "a1",
    userId,
    providerId: "google",
    accountId: "g-1",
    createdAt: now,
    updatedAt: now,
  });
  const refusal = {
    message: "Demo accounts are made by the seed. Use the persona switch.",
  };
  await t.run(async (ctx) => {
    // The hooks take no endpoint; the extra argument proves it is ignored.
    type Hook<T> = (row: T, endpoint?: unknown) => Promise<unknown>;
    const hooksOf = (seed?: boolean) => {
      const h = createAuth(ctx, { seed }).options.databaseHooks!;
      return {
        createUser: h.user!.create!.before as Hook<typeof omar>,
        createAccount: h.account!.create!.before as Hook<
          ReturnType<typeof link>
        >,
      };
    };
    const { createUser, createAccount } = hooksOf();
    // Whatever the endpoint: none, one without a request, one with.
    for (const endpoint of [null, {}, browser]) {
      await expect(createUser(omar, endpoint)).rejects.toMatchObject(refusal);
      await expect(
        createAccount(link(accounts.priya!), endpoint),
      ).rejects.toMatchObject(refusal);
      // Real accounts pass.
      await expect(
        createUser({ ...omar, email: "omar@example.com" }, endpoint),
      ).resolves.toBeUndefined();
      await expect(
        createAccount(link(bec.subject), endpoint),
      ).resolves.toBeUndefined();
    }
    // Only the seed's own auth lets a demo user or login through.
    const seeded = hooksOf(true);
    await expect(seeded.createUser(omar, null)).resolves.toBeUndefined();
    await expect(
      seeded.createAccount(link(accounts.priya!), null),
    ).resolves.toBeUndefined();
  });

  // The seed signs the whole cast up through Better Auth, and they sign in.
  const fresh = harness();
  await fresh.action(internal.seed.reset, {});
  const made = await fresh.run(async (ctx) => {
    const ids = [];
    for (const p of ACCOUNT_HOLDERS) ids.push(await demoUserId(ctx, p.email));
    return ids;
  });
  expect(made.filter(Boolean)).toHaveLength(ACCOUNT_HOLDERS.length);
  const signIn = await post(fresh, "/sign-in/email", {
    email: "priya.raman@calderlane.com.au",
    password: PASSWORD,
  });
  expect(signIn.status).toBe(200);
});

test("demo.reset is refused outside the demo, and without demo mode", async () => {
  const t = harness();
  const { owner, orgId } = await workspace(t);
  const accounts = await seedDemoAccounts(t);
  const demoId = await t.mutation(internal.seed.writeCalderLane, { accounts });
  const priya = t.withIdentity({ subject: accounts.priya });

  await expect(
    owner.mutation(api.demo.reset, { expectOrgId: orgId }),
  ).rejects.toMatchObject({
    data: { code: "FORBIDDEN" },
  });
  await expect(
    t
      .withIdentity({ subject: "user_loner" })
      .mutation(api.demo.reset, { expectOrgId: demoId }),
  ).rejects.toMatchObject({ data: { code: "NO_WORKSPACE" } });

  await priya.mutation(api.demo.reset, { expectOrgId: demoId });
  const active = await priya.query(api.orgs.active, {});
  expect(active?.org.slug).toBe("calder-lane");
  expect(active?.org._id).not.toBe(demoId);

  vi.stubEnv("DEMO_MODE", "");
  await expect(
    priya.mutation(api.demo.reset, { expectOrgId: active!.org._id }),
  ).rejects.toMatchObject({
    data: { code: "FEATURE_UNAVAILABLE" },
  });
  await expect(t.action(internal.seed.reset, {})).rejects.toMatchObject({
    data: { code: "FEATURE_UNAVAILABLE" },
  });
});

test("any persona in the demo can reset it, Dan included", async () => {
  const t = harness();
  const accounts = await seedDemoAccounts(t);
  const demoId = await t.mutation(internal.seed.writeCalderLane, { accounts });
  // The script seats Dan on 8 September; seat him as an Employee by hand.
  await t.run(async (ctx) => {
    const roles = await ctx.db
      .query("orgRoles")
      .withIndex("by_org", (q) => q.eq("orgId", demoId))
      .collect();
    const employee = roles.find((r) => r.name === "Employee");
    if (!employee) throw new Error("no Employee role");
    await ctx.db.insert("people", {
      orgId: demoId,
      roleId: employee._id,
      ...personFields(accounts.dan!, "Dan Okafor"),
    });
  });
  const dan = t.withIdentity({ subject: accounts.dan });
  expect((await dan.query(api.orgs.active, {}))?.org._id).toBe(demoId);

  await dan.mutation(api.demo.reset, { expectOrgId: demoId });
  expect(await dan.query(api.orgs.active, {})).toBeNull();
  const priya = t.withIdentity({ subject: accounts.priya });
  expect((await priya.query(api.orgs.active, {}))?.org._id).not.toBe(demoId);
});
