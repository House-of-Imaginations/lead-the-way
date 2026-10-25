import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery, preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, openOrHome } from "@/lib/account/queries";
import { getCareersShell } from "@/lib/careers/shell";
import { ThisWeek } from "./_components/ThisWeek";

export const metadata: Metadata = { title: "This week" };

/** 5 and D5 This week: the credential's lessons, the check-in and Listen instead. */
export default async function ThisWeekPage() {
  const { user } = await getCareersShell();
  const hour = currentHour();
  const [week, crew, hours] = await Promise.all([
    openOrHome(() => preloadAuthQuery(api.careers.learning.thisWeek, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.crews.mine, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.hours.mine, { hour })),
  ]);
  // No week before joining a crew.
  if (!crew?.joined) redirect("/careers/crew/join");
  // ponytail: one of the crew is you, found by name; ids stay on the server (P2).
  const others = [...crew.members];
  const me = others.findIndex(
    (m) =>
      m.initials === user.initials && m.firstName === user.name.split(" ")[0],
  );
  if (me >= 0) others.splice(me, 1);
  return (
    <ThisWeek
      week={week}
      hours={hours?.hoursPerWeek ?? 1}
      guide={crew.guide}
      others={others}
    />
  );
}
