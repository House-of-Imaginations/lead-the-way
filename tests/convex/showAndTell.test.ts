import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { castOf, type CastKey } from "../../convex/lib/demo/cast";
import type { DemoTarget } from "../../convex/lib/demo/schedule";
import { calderLane, type T } from "./workspace/helpers";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "on");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const move = (t: T, target: DemoTarget) =>
  t.mutation(internal.seed.clock, { target });

async function personOf(t: T, orgId: Id<"orgs">, key: CastKey) {
  return await t.run(async (ctx) => {
    const people = await ctx.db
      .query("people")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return people.find((p) => p.email === castOf(key).email)!._id;
  });
}

/** Dan's own words. Each text field carries a marker the board must never show. */
const OWN = {
  title: "Dan's own weekly report",
  before: "BEFORE-PRIVATE",
  change: "CHANGE-PRIVATE",
  after: "AFTER-PRIVATE",
  resultTypes: ["Time saved"],
  headline: "HEADLINE-PRIVATE",
  humanReviewed: true,
  dataSafe: true,
};

test("a draft and an unpresented project are invisible on the board", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week2");
  const dan = as("dan");
  const expectOrgId = orgId;
  // A teammate and the manager: neither may see Dan's project before he presents it.
  const others = [as("mei"), as("priya")];

  const invisible = async () => {
    for (const who of others) {
      const board = (await who.query(api.showAndTell.board, {}))!;
      expect(board.presented).toEqual([]);
      expect(board.weekTag).toBeNull();
      expect(JSON.stringify(board)).not.toMatch(/Dan's own|PRIVATE|Okafor/);
    }
  };

  // His draft, in his own words.
  await dan.mutation(api.projects.saveDraft, {
    ...OWN,
    humanReviewed: false,
    dataSafe: false,
    expectOrgId,
  });
  await invisible();

  // Saved, not yet presented.
  await dan.mutation(api.projects.save, { ...OWN, expectOrgId });
  await invisible();
  expect((await dan.query(api.showAndTell.board, {}))!.mine).toMatchObject({
    title: OWN.title,
    presented: false,
  });

  // Presenting shares the title and his first name, nothing else.
  await dan.mutation(api.projects.present, { expectOrgId });
  for (const who of others) {
    const board = (await who.query(api.showAndTell.board, {}))!;
    expect(board.presented).toEqual([{ title: OWN.title, firstName: "Dan" }]);
    expect(JSON.stringify(board)).not.toMatch(/PRIVATE|Okafor/);
  }

  // The rest present at the show and tell, after Dan, in the order they presented.
  await move(t, "complete");
  expect((await as("mei").query(api.showAndTell.board, {}))!.presented).toEqual(
    [
      { title: OWN.title, firstName: "Dan" },
      { title: "Meeting notes to action lists", firstName: "Mei" },
      { title: "First drafts of client follow-up emails", firstName: "Sarah" },
      { title: "Summarising account research", firstName: "Tomás" },
      { title: "Proposal section drafts", firstName: "Aisha" },
      { title: "Checking spreadsheet formulas", firstName: "Luca" },
    ],
  );
});

test("the board's own facts are the viewer's", async () => {
  const { t, orgId, as } = await calderLane();
  await move(t, "week4");
  const dan = as("dan");
  // Week 4, 1:00 PM: badge issued on the 24th, project saved on the 29th,
  // not presented yet (2:30 PM), after check-in not answered (3:30 PM).
  expect(await dan.query(api.showAndTell.board, {})).toEqual({
    weekTag: "Week 4",
    askBeforeSharing: true,
    afterCheckIn: true,
    hasBadge: true,
    mine: {
      title: "AI-assisted weekly client reporting",
      headline: "40 minutes saved per week",
      before:
        "Weekly client reports took about 2 hours to pull together from account notes.",
      change:
        "Copilot drafts the summary from the notes; I check every figure against the source.",
      after:
        "Reports take about 1 hour 20 minutes, with the same checks as before.",
      learned: null,
      humanReviewed: true,
      dataSafe: true,
      presented: false,
      onBadge: false,
    },
    presented: [],
  });

  // "Ask before sharing" off: the page presents without the modal.
  // Outside t.run: a t.run nested in another waits on it forever.
  const danId = await personOf(t, orgId, "dan");
  await t.run(async (ctx) =>
    ctx.db.insert("settings", {
      orgId,
      personId: danId,
      weeklyReminder: true,
      showAndTellReminder: true,
      askBeforeSharing: false,
      reflectionsOnCredential: true,
      includeInTeamTotals: true,
      captionsByDefault: true,
      reduceMotion: false,
    }),
  );
  expect((await dan.query(api.showAndTell.board, {}))!.askBeforeSharing).toBe(
    false,
  );

  // After the hour: presented, check-in answered, reflection on the badge.
  await move(t, "complete");
  expect(await dan.query(api.showAndTell.board, {})).toMatchObject({
    weekTag: "Week 4",
    afterCheckIn: false,
    mine: {
      presented: true,
      onBadge: true,
      learned:
        "AI helped speed up the first draft, but I still needed to verify the client metrics manually.",
    },
  });
  // Priya has no project of her own.
  expect((await as("priya").query(api.showAndTell.board, {}))!.mine).toBeNull();
});
