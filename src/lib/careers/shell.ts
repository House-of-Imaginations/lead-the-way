import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import {
  currentHour,
  getAccountShell,
  getHome,
  openOrHome,
} from "@/lib/account/queries";
import { NAV_COOKIE, parseNav } from "@/lib/navState";
import { checkInLabel } from "./when";

/**
 * What the careers member shell draws: the account, the path block and the
 * next check-in. Signed-in learners only: anyone else goes where they belong.
 * One read per request, however many layouts and pages ask.
 */
export const getCareersShell = cache(async () => {
  const all = await getAccountShell();
  if (!all?.career) redirect((await getHome()) ?? "/signed-out");
  const hour = currentHour();
  const [summary, week, jar] = await Promise.all([
    openOrHome(() => fetchAuthQuery(api.home.summary, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.learning.thisWeek, { hour })),
    cookies(),
  ]);
  return {
    user: all.account,
    hasTeam: !!all.team,
    switcher: all.switcher ?? null,
    target: summary.career?.targetRole ?? null,
    from: summary.career?.currentRole ?? null,
    checkIn: week && checkInLabel(week.checkIn.date, week.checkIn.time),
    navState: parseNav(jar.get(NAV_COOKIE)?.value),
  };
});

export type CareersShellData = Awaited<ReturnType<typeof getCareersShell>>;
