import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { calderLane, clock } from "./workspace/helpers";

// P13b part B: what screens 6, 7 and D8 read beyond P12, and the e2e clock.

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: { data?: { code?: string } }) => e.data?.code,
  );

async function careersDemo() {
  const lane = await calderLane();
  await lane.t.mutation(internal.seed.writeCareers, {});
  return lane;
}

test("D8: a private track reads and changes its contact address under X3", async () => {
  const { t, as } = await calderLane();
  await clock(t, "week2"); // Dan is seated from week 1.
  const dan = as("dan");
  await dan.mutation(api.careers.tracks.startPrivate, {
    contactEmail: "dan@home.example",
  });
  const mine = await dan.query(api.careers.careerSettings.mine, {});
  expect(mine).toMatchObject({
    private: true,
    contactEmail: "dan@home.example",
  });
  const set = (contactEmail: string) =>
    codeOf(dan.mutation(api.careers.tracks.setContactEmail, { contactEmail }));
  for (const refused of [
    "not an address",
    "dan.okafor@calderlane.com.au",
    "dan@mail.calderlane.com.au",
  ])
    expect(await set(refused)).toBe("CONTACT_EMAIL_INVALID");
  expect(await set(" Dan.O@Elsewhere.example ")).toBe("ok");
  expect(
    (await dan.query(api.careers.careerSettings.mine, {})).contactEmail,
  ).toBe("dan.o@elsewhere.example");
});

test("D8: a partner track has no separate contact address to change", async () => {
  const { as } = await careersDemo();
  const amara = as("amara");
  expect(await amara.query(api.careers.careerSettings.mine, {})).toMatchObject({
    private: false,
    contactEmail: null,
  });
  expect(
    await codeOf(
      amara.mutation(api.careers.tracks.setContactEmail, {
        contactEmail: "amara@home.example",
      }),
    ),
  ).toBe("FORBIDDEN");
});

test("seed:careerClock plays the proof step; 6 reads the project's title", async () => {
  const { t, as } = await careersDemo();
  expect(
    await t.mutation(internal.seed.careerClock, { target: "proof" }),
  ).toMatchObject({ missedWeek: false });
  const mine = await as("amara").query(api.careers.proof.mine, {});
  expect(mine.badges.map((b) => b.name)).toEqual(["Data Fundamentals"]);
  expect(mine.project).toMatchObject({
    title: "Sales dashboard, Western suburbs stores",
    reviewed: true,
    addReflectionToProof: true,
  });
  expect(mine.endorsements[0]?.guide.firstName).toBe("Lena");
  await t.mutation(internal.seed.careerClock, { target: "missedWeek" });
  expect(
    await t.run(
      async (ctx) => (await ctx.db.query("careerDemo").first())?.missedWeek,
    ),
  ).toBe(true);
});

test("seed:careerClock needs DEMO_MODE and a seeded careers demo", async () => {
  const { t } = await calderLane();
  expect(
    await codeOf(t.mutation(internal.seed.careerClock, { target: "week2" })),
  ).toBe("DEMO_NOT_SEEDED");
  vi.stubEnv("DEMO_MODE", "off");
  await expect(
    t.mutation(internal.seed.careerClock, { target: "week2" }),
  ).rejects.toThrow();
});
