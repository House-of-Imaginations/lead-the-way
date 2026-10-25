import type { Metadata } from "next";
import { api } from "@convex/_generated/api";
import { preloadAuthQuery } from "@/lib/account/auth-server";
import { currentHour, openOrHome } from "@/lib/account/queries";
import { getCareersShell } from "@/lib/careers/shell";
import { JoinCrew } from "./_components/JoinCrew";

export const metadata: Metadata = { title: "Join a crew" };

/** 4 Join a crew: the guide, the crew and the Crew Agreement builder. */
export default async function JoinCrewPage() {
  // First: the shell sends anyone without a learner track home.
  const { target } = await getCareersShell();
  const hour = currentHour();
  const [crew, rules] = await Promise.all([
    openOrHome(() => preloadAuthQuery(api.careers.crews.mine, { hour })),
    openOrHome(() => preloadAuthQuery(api.careers.crews.rules, { hour })),
  ]);
  return <JoinCrew crew={crew} rules={rules} target={target} />;
}
