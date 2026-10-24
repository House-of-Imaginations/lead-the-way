import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { insertProfile } from "../../convex/lib/account/profile";
import { insertCareerProfile } from "../../convex/lib/careers/writers";
import { addCareer, harness, type T } from "./workspace/helpers";

/** The careers clock's targets in AEDT (spec 7), as instants. */
const WEEK1 = "2026-10-25T22:00:00Z";
const WEEK2 = "2026-11-03T01:00:00Z";
const WEEK3 = "2026-11-10T01:00:00Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(WEEK2));
});
afterEach(() => {
  vi.useRealTimers();
});

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: { data?: { code?: string } }) => e.data?.code,
  );

/** A learner heading to `targetRole`, with the D8 settings defaults. */
async function learner(
  t: T,
  subject: string,
  name: string,
  targetRole: "data-analyst" | "business-analyst" = "data-analyst",
) {
  const careerProfileId = await t.run(async (ctx) => {
    await insertProfile(ctx, subject, name);
    return await insertCareerProfile(ctx, {
      userId: subject,
      firstName: name.split(" ")[0]!,
      targetRole,
      hoursPerWeek: 2,
      private: false,
    });
  });
  return { as: t.withIdentity({ subject }), careerProfileId };
}

/** Lena's Data Analyst crew, from Monday 26 October, with her drafted rules. */
async function crew(t: T) {
  const guide = t.withIdentity({ subject: "user_lena" });
  const guideId = await addCareer(guide, "guide");
  const crewId = await t.run(async (ctx) => {
    await ctx.db.patch(guideId, { firstName: "Lena", guideBio: "Analyst." });
    const crewId = await ctx.db.insert("crews", {
      guideId,
      targetRole: "data-analyst",
      credentialId: "data-fundamentals",
      checkInDay: 2,
      checkInTime: "19:00",
      startsOn: "2026-10-26",
      capacity: 5,
    });
    for (const text of ["Protect the hours you picked", "No judgement, ever"])
      await ctx.db.insert("crewRules", {
        crewId,
        text,
        source: "guide",
        status: "active",
      });
    await ctx.db.insert("crewRules", {
      crewId,
      text: "Camera optional on check-ins",
      source: "guide",
      status: "suggested",
    });
    return crewId;
  });
  return { guide, crewId };
}

/** Lessons finished at `at`, written straight to the table. */
async function finished(
  t: T,
  careerProfileId: Id<"careerProfiles">,
  at: string,
  lessonIds: string[],
) {
  await t.run(async (ctx) => {
    for (const lessonId of lessonIds)
      await ctx.db.insert("lessonProgress", {
        careerProfileId,
        lessonId,
        completedAt: Date.parse(at),
      });
  });
}

test("crews: join, tick, propose, remove and agree", async () => {
  const t = harness();
  const { guide, crewId } = await crew(t);
  const amara = await learner(t, "user_amara", "Amara Okoye");

  // Before joining, the crew to join and its drafted agreement.
  expect(await amara.as.query(api.careers.crews.mine, {})).toEqual({
    crewId,
    joined: false,
    agreed: false,
    guide: { firstName: "Lena", initials: "L", bio: "Analyst." },
    members: [],
    checkInDay: 2,
    checkInTime: "19:00",
    startsOn: "2026-10-26",
  });
  const rules = await amara.as.query(api.careers.crews.rules, {});
  expect(rules.map((r) => [r.text, r.on, r.mine])).toEqual([
    ["Protect the hours you picked", true, false],
    ["No judgement, ever", true, false],
    ["Camera optional on check-ins", false, false],
  ]);

  await amara.as.mutation(api.careers.crews.toggleRule, {
    ruleId: rules[2]!.ruleId,
    on: true,
  });
  await amara.as.mutation(api.careers.crews.toggleRule, {
    ruleId: rules[0]!.ruleId,
    on: false,
  });
  const mineId = await amara.as.mutation(api.careers.crews.proposeRule, {
    text: "  Share one link a week  ",
  });
  expect(
    await code(
      amara.as.mutation(api.careers.crews.proposeRule, { text: "   " }),
    ),
  ).toBe("FIELD_REQUIRED");
  expect(
    (await amara.as.query(api.careers.crews.rules, {})).map((r) => [
      r.text,
      r.on,
      r.mine,
      r.source,
    ]),
  ).toEqual([
    ["Protect the hours you picked", false, false, "guide"],
    ["No judgement, ever", true, false, "guide"],
    ["Camera optional on check-ins", true, false, "guide"],
    ["Share one link a week", true, true, "member"],
  ]);

  // Agreeing comes after joining; both keep the first time.
  expect(await code(amara.as.mutation(api.careers.crews.agree, {}))).toBe(
    "NOT_FOUND",
  );
  expect(await amara.as.mutation(api.careers.crews.joinCrew, {})).toBe(crewId);
  expect(await amara.as.mutation(api.careers.crews.joinCrew, {})).toBe(crewId);
  await amara.as.mutation(api.careers.crews.agree, {});
  vi.setSystemTime(new Date(WEEK3));
  await amara.as.mutation(api.careers.crews.agree, {});
  const members = await t.run((ctx) =>
    ctx.db
      .query("crewMembers")
      .withIndex("by_crew", (q) => q.eq("crewId", crewId))
      .collect(),
  );
  expect(members).toHaveLength(1);
  expect(members[0]!.agreedAt).toBe(Date.parse(WEEK2));
  expect(await amara.as.query(api.careers.crews.mine, {})).toMatchObject({
    joined: true,
    agreed: true,
    members: [{ firstName: "Amara", initials: "AO" }],
  });

  // A crewmate sees the proposal unnamed, and can't remove it.
  const jordan = await learner(t, "user_jordan", "Jordan Park");
  await jordan.as.mutation(api.careers.crews.joinCrew, {});
  const seen = (await jordan.as.query(api.careers.crews.rules, {})).at(-1)!;
  expect(seen).toEqual({
    ruleId: mineId,
    text: "Share one link a week",
    source: "member",
    on: false,
    mine: false,
  });
  expect(
    await code(
      jordan.as.mutation(api.careers.crews.removeMyRule, { ruleId: mineId }),
    ),
  ).toBe("NOT_FOUND");
  await jordan.as.mutation(api.careers.crews.toggleRule, {
    ruleId: mineId,
    on: true,
  });
  await amara.as.mutation(api.careers.crews.removeMyRule, { ruleId: mineId });
  expect(await t.run((ctx) => ctx.db.get(mineId))).toBeNull();
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("ruleChoices")
        .withIndex("by_rule", (q) => q.eq("ruleId", mineId))
        .collect(),
    ),
  ).toEqual([]);
  // A guide rule is not theirs to remove.
  expect(
    await code(
      amara.as.mutation(api.careers.crews.removeMyRule, {
        ruleId: rules[0]!.ruleId,
      }),
    ),
  ).toBe("NOT_FOUND");

  // P11: another learner's crew is not theirs to read or change.
  const dan = await learner(t, "user_dan", "Dan Okafor", "business-analyst");
  expect(await dan.as.query(api.careers.crews.mine, {})).toBeNull();
  expect(await dan.as.query(api.careers.crews.rules, {})).toEqual([]);
  expect(await dan.as.query(api.careers.crews.status, {})).toEqual([]);
  expect(
    await code(
      dan.as.mutation(api.careers.crews.toggleRule, {
        ruleId: rules[0]!.ruleId,
        on: false,
      }),
    ),
  ).toBe("NOT_FOUND");
  expect(await code(dan.as.mutation(api.careers.crews.joinCrew, {}))).toBe(
    "NOT_FOUND",
  );
  // P11: a guide profile is not a learner track.
  expect(await guide.query(api.careers.crews.mine, {})).toBeNull();
  expect(await guide.query(api.careers.crews.rules, {})).toEqual([]);
  expect(await guide.query(api.careers.crews.status, {})).toEqual([]);
  for (const call of [
    guide.mutation(api.careers.crews.joinCrew, {}),
    guide.mutation(api.careers.crews.agree, {}),
    guide.mutation(api.careers.crews.proposeRule, { text: "Mine" }),
  ])
    expect(await code(call)).toBe("NO_CAREER_TRACK");
  // P11: signed out.
  expect(await code(t.query(api.careers.crews.mine, {}))).toBe("NOT_SIGNED_IN");
});

test("P2: the crew sees done, back or not yet, and nothing when it is off", async () => {
  const t = harness();
  await crew(t);
  const amara = await learner(t, "user_amara", "Amara Okoye");
  const jordan = await learner(t, "user_jordan", "Jordan Park");
  const sofia = await learner(t, "user_sofia", "Sofia Marino");
  const tevita = await learner(t, "user_tevita", "Tevita Fifita");
  for (const m of [amara, jordan, sofia, tevita])
    await m.as.mutation(api.careers.crews.joinCrew, {});
  await finished(t, jordan.careerProfileId, WEEK1, ["data-fundamentals-1"]);
  await finished(t, jordan.careerProfileId, WEEK2, ["data-fundamentals-4"]);
  await finished(t, sofia.careerProfileId, WEEK2, [
    "data-fundamentals-1",
    "data-fundamentals-2",
  ]);
  await finished(t, tevita.careerProfileId, WEEK2, ["data-fundamentals-1"]);
  await t.run(async (ctx) => {
    const settings = await ctx.db
      .query("careerSettings")
      .withIndex("by_careerProfile", (q) =>
        q.eq("careerProfileId", tevita.careerProfileId),
      )
      .unique();
    await ctx.db.patch(settings!._id, { showDoneToCrew: false });
  });
  const status = await jordan.as.query(api.careers.crews.status, {});
  expect(status).toEqual([
    { firstName: "Amara", initials: "AO", status: "notYet" },
    { firstName: "Jordan", initials: "JP", status: "done" },
    { firstName: "Sofia", initials: "SM", status: "back" },
  ]);
  // Never counts, minutes, hours or days: the three keys only.
  expect(Object.keys(status[0]!).sort()).toEqual([
    "firstName",
    "initials",
    "status",
  ]);
  // In week 1 nobody has been away yet.
  vi.setSystemTime(new Date(WEEK1));
  expect(
    (await amara.as.query(api.careers.crews.status, {})).map((s) => s.status),
  ).toEqual(["notYet", "done", "notYet"]);
});

test("hours: as many days as hours, a Busy hold, and a 4-week preview", async () => {
  const t = harness();
  const { guide } = await crew(t);
  const amara = await learner(t, "user_amara", "Amara Okoye");
  expect(await amara.as.query(api.careers.hours.mine, {})).toEqual({
    hoursPerWeek: 2,
    saved: null,
  });
  expect(
    await amara.as.query(api.careers.hours.weekPreview, { days: [4, 0] }),
  ).toBeNull();
  await amara.as.mutation(api.careers.crews.joinCrew, {});

  const save = (days: number[], startTime = "20:00") =>
    code(
      amara.as.mutation(api.careers.hours.save, {
        days,
        startTime,
        calendarHold: true,
      }),
    );
  expect(await save([4])).toBe("FIELD_REQUIRED");
  expect(await save([4, 4])).toBe("FIELD_REQUIRED");
  expect(await save([4, 7])).toBe("FIELD_REQUIRED");
  expect(await save([4, 0], "8 PM")).toBe("FIELD_REQUIRED");
  expect(await save([4, 0])).toBe("ok");
  expect(await amara.as.query(api.careers.hours.mine, {})).toEqual({
    hoursPerWeek: 2,
    saved: {
      days: [0, 4],
      startTime: "20:00",
      calendarHold: true,
      holdTitle: "Busy",
    },
  });
  // P7: the stored hold has no title or text at all.
  const rows = await t.run((ctx) => ctx.db.query("protectedHours").collect());
  expect(rows).toHaveLength(1);
  expect(Object.keys(rows[0]!).sort()).toEqual([
    "_creationTime",
    "_id",
    "calendarHold",
    "careerProfileId",
    "days",
    "startTime",
  ]);
  await amara.as.mutation(api.careers.hours.save, {
    days: [1, 3],
    startTime: "07:00",
    calendarHold: false,
  });
  expect(
    (await amara.as.query(api.careers.hours.mine, {}))?.saved?.holdTitle,
  ).toBeNull();

  const preview = await amara.as.query(api.careers.hours.weekPreview, {
    days: [4, 0],
  });
  expect(preview?.checkInTime).toBe("19:00");
  expect(preview?.weeks).toHaveLength(4);
  expect(preview?.weeks[0]).toEqual([
    { date: "2026-10-26", learning: false, checkIn: false },
    { date: "2026-10-27", learning: false, checkIn: true },
    { date: "2026-10-28", learning: false, checkIn: false },
    { date: "2026-10-29", learning: true, checkIn: false },
    { date: "2026-10-30", learning: false, checkIn: false },
    { date: "2026-10-31", learning: false, checkIn: false },
    { date: "2026-11-01", learning: true, checkIn: false },
  ]);
  expect(preview?.weeks[3]![6]!.date).toBe("2026-11-22");

  // P11: another learner sees only their own hours; a guide sees none.
  const jordan = await learner(t, "user_jordan", "Jordan Park");
  expect(await jordan.as.query(api.careers.hours.mine, {})).toEqual({
    hoursPerWeek: 2,
    saved: null,
  });
  expect(await guide.query(api.careers.hours.mine, {})).toBeNull();
  expect(
    await code(
      guide.mutation(api.careers.hours.save, {
        days: [1, 3],
        startTime: "07:00",
        calendarHold: false,
      }),
    ),
  ).toBe("NO_CAREER_TRACK");
  expect(await code(t.query(api.careers.hours.mine, {}))).toBe("NOT_SIGNED_IN");
});

test("learning: this week's lessons, the count and Listen instead", async () => {
  const t = harness();
  const { guide } = await crew(t);
  const amara = await learner(t, "user_amara", "Amara Okoye");
  expect(await amara.as.query(api.careers.learning.thisWeek, {})).toBeNull();
  await amara.as.mutation(api.careers.crews.joinCrew, {});
  await finished(t, amara.careerProfileId, WEEK1, [
    "data-fundamentals-1",
    "data-fundamentals-2",
    "data-fundamentals-3",
  ]);
  await amara.as.mutation(api.careers.learning.completeLesson, {
    lessonId: "data-fundamentals-4",
  });
  await amara.as.mutation(api.careers.learning.completeLesson, {
    lessonId: "data-fundamentals-4",
  });
  expect(
    await code(
      amara.as.mutation(api.careers.learning.completeLesson, {
        lessonId: "not-a-lesson",
      }),
    ),
  ).toBe("NOT_FOUND");
  await amara.as.mutation(api.careers.learning.setListen, { on: true });

  const week = await amara.as.query(api.careers.learning.thisWeek, {});
  expect(week).toMatchObject({
    credentialId: "data-fundamentals",
    credentialName: "Data Fundamentals",
    credentialNumber: 1,
    credentialCount: 3,
    week: 2,
    done: 4,
    total: 11,
    checkIn: { date: "2026-11-03", time: "19:00" },
    listenInstead: true,
  });
  expect(week?.lessons.map((l) => [l.title, l.minutes, l.done])).toEqual([
    ["Excel basics for data", 12, true],
    ["Cleaning a messy table", 15, false],
    ["Project step: tidy a sales dataset", 20, false],
    ["Checking your totals", 10, false],
  ]);
  expect(week?.comingUp?.opensOn).toBe("2026-11-09");
  expect(week?.comingUp?.lessons[0]?.title).toBe("Joining two tables");

  // P11: a guide has no lessons; another learner doesn't see these.
  expect(await guide.query(api.careers.learning.thisWeek, {})).toBeNull();
  expect(
    await code(guide.mutation(api.careers.learning.setListen, { on: true })),
  ).toBe("NO_CAREER_TRACK");
  const jordan = await learner(t, "user_jordan", "Jordan Park");
  await jordan.as.mutation(api.careers.crews.joinCrew, {});
  expect(
    await jordan.as.query(api.careers.learning.thisWeek, {}),
  ).toMatchObject({ done: 0, listenInstead: false });
  expect(await code(t.query(api.careers.learning.thisWeek, {}))).toBe(
    "NOT_SIGNED_IN",
  );
});

test("P6: re-entry is worked out from completion dates, and nothing is stored", async () => {
  const t = harness();
  const { guide } = await crew(t);
  const amara = await learner(t, "user_amara", "Amara Okoye");
  await amara.as.mutation(api.careers.crews.joinCrew, {});
  // Busy in week 1, then one lesson in week 2: pick up at lesson 2 of 4.
  await amara.as.mutation(api.careers.learning.completeLesson, {
    lessonId: "data-fundamentals-4",
  });
  expect(await amara.as.query(api.careers.learning.reentry, {})).toEqual({
    lessonId: "data-fundamentals-5",
    title: "Cleaning a messy table",
    minutes: 15,
    position: 2,
    of: 4,
  });
  // A lesson in week 1 means no banner.
  await finished(t, amara.careerProfileId, WEEK1, ["data-fundamentals-1"]);
  expect(await amara.as.query(api.careers.learning.reentry, {})).toBeNull();
  // The demo's missedWeek flag shows it anyway.
  await t.run((ctx) => ctx.db.insert("careerDemo", { missedWeek: true }));
  expect(
    (await amara.as.query(api.careers.learning.reentry, {}))?.position,
  ).toBe(2);
  // P6: completions hold no streak or missed-week field.
  const rows = await t.run((ctx) => ctx.db.query("lessonProgress").collect());
  for (const row of rows)
    expect(Object.keys(row).sort()).toEqual([
      "_creationTime",
      "_id",
      "careerProfileId",
      "completedAt",
      "lessonId",
    ]);
  // For the learner only (P11).
  const jordan = await learner(t, "user_jordan", "Jordan Park");
  expect(await jordan.as.query(api.careers.learning.reentry, {})).toBeNull();
  expect(await guide.query(api.careers.learning.reentry, {})).toBeNull();
  expect(await code(t.query(api.careers.learning.reentry, {}))).toBe(
    "NOT_SIGNED_IN",
  );
});
