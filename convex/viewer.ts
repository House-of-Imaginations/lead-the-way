import { v } from "convex/values";
import { publicQuery } from "./lib/customFunctions";
import { initialsOf } from "./lib/initials";
import { accountShellValidator, homeOf, shellOf, tracksOf } from "./lib/shell";
import { getAccount } from "./lib/viewer";

/**
 * Where this person belongs: null signed out, "/home" with two tracks, the
 * team's area home (R4), "/careers/journey" with a career track only, else
 * "/start" to choose one. Signed out on purpose: the proxy sees only a
 * cookie, and a stale cookie must end at /login, not in a loop.
 */
export const home = publicQuery({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    if (!ctx.userId) return null;
    const { team, career } = await getAccount(ctx);
    if (team && career) return "/home";
    if (team) return await homeOf(ctx, team);
    // ponytail: P12b sends a learner without a crew to /careers/crew/join (spec 5.2).
    if (career) return "/careers/journey";
    return "/start";
  },
});

/**
 * Everything the app shell draws (R3): the account, plus `team` with a seat
 * and `career` with a learner track. Null signed out. `hour` is ignored
 * (Ruling 14). The server passes the current hour, so a new hour is a new
 * query, and Convex reads the clock again.
 */
export const shell = publicQuery({
  args: { hour: v.optional(v.number()) },
  returns: v.union(v.null(), accountShellValidator),
  handler: async (ctx) => {
    if (!ctx.userId) return null;
    const { account, team, career } = await getAccount(ctx);
    const teamShell = team && (await shellOf(ctx, team));
    return {
      account: { name: account.name, initials: initialsOf(account.name) },
      ...(teamShell && { team: teamShell }),
      ...(career && { career: { private: career.profile.private } }),
      // R2: a seat and a learner profile (`career` is learner only, R6).
      ...(team &&
        teamShell &&
        career && { switcher: await tracksOf(ctx, team, teamShell, career) }),
    };
  },
});
