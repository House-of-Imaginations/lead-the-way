import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { fetchAuthQuery } from "@/lib/account/auth-server";
import { currentHour, openOrHome } from "@/lib/account/queries";
import { getCareersShell } from "@/lib/careers/shell";
import { ProtectHours } from "./_components/ProtectHours";

export const metadata: Metadata = { title: "Protect your hours" };

/** 4b Protect your hours: learning days beside the crew's check-in. After joining. */
export default async function ProtectHoursPage() {
  await getCareersShell();
  const hour = currentHour();
  const [crew, hours] = await Promise.all([
    openOrHome(() => fetchAuthQuery(api.careers.crews.mine, { hour })),
    openOrHome(() => fetchAuthQuery(api.careers.hours.mine, { hour })),
  ]);
  if (!crew?.joined || !hours) redirect("/careers/crew/join");
  return (
    <ProtectHours
      hoursPerWeek={hours.hoursPerWeek ?? 1}
      saved={hours.saved}
      startsOn={crew.startsOn}
      checkInDay={crew.checkInDay}
      checkInTime={crew.checkInTime}
    />
  );
}
