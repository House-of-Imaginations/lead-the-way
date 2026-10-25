import { v } from "convex/values";
import { CREDENTIALS, lessonsFor, TARGETS } from "./lib/careers/catalog";
import { crewOf, doneLessons } from "./lib/careers/crew";
import { authenticatedQuery } from "./lib/customFunctions";
import { throwUserError } from "./lib/errors";
import { sessionOf } from "./lib/learning";
import { ownerOf } from "./lib/orgs/people";
import { launchedSprint } from "./lib/sprint";
import { hourRange, sprintPhase, weekOf } from "./lib/sprintTime";
import { getAccount } from "./lib/viewer";

/**
 * MS2 Home with two tracks (spec 5.4). X4: it reads the signed-in account's
 * own tracks and takes no id, so nobody else's data can be asked for; an
 * account with no learner track (a guide alone, say) is refused. `hour` is
 * ignored (Ruling 16).
 */
export const summary = authenticatedQuery({
  args: { hour: v.optional(v.number()) },
  returns: v.object({
    team: v.union(
      v.null(),
      v.object({
        orgName: v.string(),
        sprint: v.union(
          v.null(),
          v.object({
            week: v.number(),
            weeks: v.number(),
            protectedHour: v.string(),
            course: v.string(),
            session: v.number(),
          }),
        ),
      }),
    ),
    career: v.union(
      v.null(),
      v.object({
        private: v.boolean(),
        currentRole: v.union(v.null(), v.string()),
        targetRole: v.union(v.null(), v.string()),
        credential: v.union(v.null(), v.string()),
        // "Credential 1 of 3": the credential's place on the target's path.
        step: v.union(v.null(), v.object({ n: v.number(), of: v.number() })),
        lessonsDone: v.number(),
        lessonsTotal: v.number(),
        // 0 is Sunday; the page words it ("Tuesday, 7 PM").
        checkIn: v.union(
          v.null(),
          v.object({ day: v.number(), time: v.string() }),
        ),
        guide: v.union(v.null(), v.string()),
      }),
    ),
    whoSeesWhat: v.array(
      v.object({
        who: v.string(),
        team: v.union(v.null(), v.string()),
        career: v.union(v.null(), v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { team, career } = await getAccount(ctx);
    if (!team && !career) {
      throwUserError("NO_CAREER_TRACK", "Start a track first.");
    }
    let teamPart = null;
    let manager = "Your manager";
    if (team) {
      const sprint = await launchedSprint(ctx, team.org._id);
      const now = team.now;
      const active = sprint && sprintPhase(sprint, now) === "active";
      const week = sprint ? weekOf(sprint, now) : 0;
      manager = (await ownerOf(ctx, team.org._id))?.firstName ?? manager;
      teamPart = {
        orgName: team.org.name,
        sprint: active
          ? {
              week,
              weeks: sprint.weeks,
              protectedHour: hourRange(sprint.protectedHour, "long"),
              course: sprint.courseTitle,
              session: sessionOf(week),
            }
          : null,
      };
    }
    let careerPart = null;
    if (career) {
      const { profile } = career;
      const crew = await crewOf(ctx, profile);
      const target = TARGETS.find((t) => t.id === profile.targetRole);
      const credentialId =
        crew?.credentialId ?? target?.skills[0]?.credentialId;
      const lessons = credentialId ? lessonsFor(credentialId) : [];
      const ids = new Set(lessons.map((l) => l.id));
      const done = (await doneLessons(ctx, profile._id)).filter((p) =>
        ids.has(p.lessonId),
      ).length;
      const guide = crew && (await ctx.db.get(crew.guideId));
      const n =
        (target?.skills.findIndex((s) => s.credentialId === credentialId) ??
          -1) + 1;
      careerPart = {
        private: profile.private,
        // "Something else" reads badly before an arrow; the page drops it.
        currentRole:
          profile.currentRole && profile.currentRole !== "Something else"
            ? profile.currentRole
            : null,
        targetRole: target?.name ?? null,
        credential:
          CREDENTIALS.find((c) => c.id === credentialId)?.name ?? null,
        step: target && n > 0 ? { n, of: target.skills.length } : null,
        lessonsDone: done,
        lessonsTotal: lessons.length,
        checkIn: crew && { day: crew.checkInDay, time: crew.checkInTime },
        guide: guide?.firstName ?? null,
      };
    }
    const orgName = team?.org.name ?? "Your workspace";
    return {
      team: teamPart,
      career: careerPart,
      whoSeesWhat: [
        {
          who: team ? `${manager}, your manager` : "Your manager",
          team: team ? "Team totals only, hidden below 5 people" : null,
          career: career ? "Nothing. Not even that this track exists" : null,
        },
        {
          who: orgName,
          team: team ? "Workspace totals for the sprint" : null,
          career: career ? "Nothing" : null,
        },
        {
          who: "Your team or crew",
          team: team ? "Projects you choose to present at show and tell" : null,
          career: career ? "“Done this week”, never scores" : null,
        },
        {
          who: "Your guide",
          team: team ? "No guide on this track" : null,
          career: career ? "Lesson progress, if you allow it" : null,
        },
      ],
    };
  },
});
