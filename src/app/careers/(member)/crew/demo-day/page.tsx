import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery, preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, openOrHome } from "@/lib/account/queries";
import { getCareersShell } from "@/lib/careers/shell";
import { DemoDay } from "./_components/DemoDay";

export const metadata: Metadata = { title: "Crew demo day" };

/** 5b Crew demo day: your project, your reflection and what the crew chose to present. */
export default async function DemoDayPage() {
  await getCareersShell();
  const hour = currentHour();
  const [week, session] = await Promise.all([
    openOrHome(() => fetchAuthQuery(api.careers.learning.thisWeek, { hour })),
    openOrHome(() => preloadAuthQuery(api.careers.demoDay.session, { hour })),
  ]);
  // No crew, no demo day.
  if (!week) redirect("/careers/crew/join");
  return (
    <DemoDay
      session={session}
      step={`Credential ${week.credentialNumber} of ${week.credentialCount}, week ${week.week}`}
    />
  );
}
